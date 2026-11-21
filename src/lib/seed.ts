/**
 * Seed adapter (server-only). Turns dev_gold.json into the CLAUDE.md extraction-output shape so the UI
 * can be built before live extraction exists. Later, docket_data/data/cache/extraction_<SUP>.json
 * replaces a seed through the SAME getSupplierView(supplierId).
 */
import { z } from "zod";
import { DEMO_TODAY } from "./config";
import {
  loadBenchmarks,
  loadCache,
  loadCpi,
  loadDevGold,
  loadFx,
  loadHolidays,
  loadLedger,
  loadPolicy,
  loadTracker,
} from "./data";
import { evaluateSupplier, type RulesContext, type SupplierEvaluation } from "./rules/flags";
import {
  ExtractionOutputSchema,
  RateLineSchema,
  VendorQuoteSchema,
  type Category,
  type DevGoldSupplier,
  type ExtractionOutput,
  type Field,
  type Request,
} from "./types";

export const SEED_CONFIDENCE = 0.95;

/** Extraction output plus the extra AI-extracted facts the Rules need (quote, rate card). */
export const SupplierExtractionSchema = ExtractionOutputSchema.extend({
  quote: VendorQuoteSchema.optional(),
  rate_card: z.array(RateLineSchema).optional(),
});
export type SupplierExtraction = z.infer<typeof SupplierExtractionSchema> & { source: "seed" | "cache" };

const seedField = <T,>(f: Field<T>): Field<T> => ({
  ...f,
  // Gold marks expected abstentions with 0.5; keep those low so X1 still fires.
  confidence: Math.min(SEED_CONFIDENCE, f.confidence),
});

export function goldToExtraction(g: DevGoldSupplier): SupplierExtraction {
  const t = g.effective_terms;
  const terms = Object.fromEntries(
    Object.entries(t).map(([k, v]) =>
      k === "uplift"
        ? [k, Object.fromEntries(Object.entries(v as Record<string, Field<unknown>>).map(([kk, vv]) => [kk, seedField(vv)]))]
        : [k, seedField(v as Field<unknown>)],
    ),
  ) as ExtractionOutput["effective_terms"];
  return { supplier_id: g.supplier_id, family: g.family, effective_terms: terms, quote: g.quote, rate_card: g.rate_card, source: "seed" };
}

let ctxPromise: Promise<RulesContext> | null = null;
export function loadRulesContext(): Promise<RulesContext> {
  ctxPromise ??= (async () => {
    const [policy, benchmarks, holidays, ledger, tracker, fx, cpi] = await Promise.all([
      loadPolicy(),
      loadBenchmarks(),
      loadHolidays(),
      loadLedger(),
      loadTracker(),
      loadFx(),
      loadCpi(),
    ]);
    return {
      policy,
      benchmarks,
      holidays: new Set(holidays.map((h) => h.date)),
      ledger,
      tracker,
      usdInr: fx.USD_INR,
      cpiPct: cpi.india_cpi_yoy_pct,
      today: DEMO_TODAY,
    };
  })();
  return ctxPromise;
}

export type SupplierMeta = { supplierId: string; name: string; category: Category; vendorId: string; erpVendorName: string };

export async function listSuppliers(): Promise<SupplierMeta[]> {
  const { suppliers } = await loadDevGold();
  return suppliers.map((s) => ({ supplierId: s.supplier_id, name: s.contract_name, category: s.category, vendorId: s.vendor_id, erpVendorName: s.erp_vendor_name }));
}

/** Cached AI extraction wins; otherwise the gold seed. */
export async function getExtraction(supplierId: string): Promise<SupplierExtraction | null> {
  const cached = await loadCache(`extraction_${supplierId}`, SupplierExtractionSchema.nullable(), null);
  if (cached) return { ...cached, source: "cache" };
  const g = (await loadDevGold()).suppliers.find((s) => s.supplier_id === supplierId);
  return g ? goldToExtraction(g) : null;
}

export type SupplierView = SupplierMeta & {
  source: "seed" | "cache";
  terms: ExtractionOutput["effective_terms"];
  family: ExtractionOutput["family"];
  flags: SupplierEvaluation["flags"];
  lane: SupplierEvaluation["lane"];
  laneReason: string;
  actBy: SupplierEvaluation["actBy"];
  money: Pick<SupplierEvaluation, "annualInr" | "monthlyInr" | "uplift" | "earliestExit"> & { currency: string };
  benchmarks: SupplierEvaluation["benchmarks"];
  ledgerSummary: SupplierEvaluation["ledger"]["summary"];
  trackerConflicts: SupplierEvaluation["trackerConflicts"];
};

export async function getSupplierView(supplierId: string): Promise<SupplierView | null> {
  const meta = (await listSuppliers()).find((s) => s.supplierId === supplierId);
  const ex = await getExtraction(supplierId);
  if (!meta || !ex) return null;
  const ev = evaluateSupplier(
    { supplierId, name: meta.name, category: meta.category, terms: ex.effective_terms, quote: ex.quote, rateCard: ex.rate_card },
    await loadRulesContext(),
  );
  const cur = ex.effective_terms.currency.value;
  return {
    ...meta,
    source: ex.source,
    terms: ex.effective_terms,
    family: ex.family,
    flags: ev.flags,
    lane: ev.lane,
    laneReason: ev.laneReason,
    actBy: ev.actBy,
    money: { annualInr: ev.annualInr, monthlyInr: ev.monthlyInr, uplift: ev.uplift, earliestExit: ev.earliestExit, currency: typeof cur === "string" && cur !== "unclear" ? cur : "INR" },
    benchmarks: ev.benchmarks,
    ledgerSummary: ev.ledger.summary,
    trackerConflicts: ev.trackerConflicts,
  };
}

export async function getAllSupplierViews(): Promise<SupplierView[]> {
  const views = await Promise.all((await listSuppliers()).map((s) => getSupplierView(s.supplierId)));
  return views.filter((v): v is SupplierView => !!v);
}

/** Initial requests Docket raises itself: state raised, or auto_logged for green. */
export function buildInitialRequests(views: SupplierView[]): Request[] {
  const ts = `${DEMO_TODAY}T09:00:00.000Z`;
  return views.map((v) => ({
    id: `REQ-${v.supplierId}`,
    supplier_id: v.supplierId,
    supplier_name: v.name,
    category: v.category,
    state: v.lane === "green" ? "auto_logged" : "raised",
    lane: v.lane,
    lane_reason: v.laneReason,
    flags: v.flags,
    act_by: v.actBy?.actBy ?? null,
    internal_by: v.actBy?.decisionTarget ?? null,
    annual_value_inr: v.money.annualInr,
    owner: "owner",
    raised_at: ts,
    updated_at: ts,
  }));
}
