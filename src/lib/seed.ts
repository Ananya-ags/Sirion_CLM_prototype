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
  loadDocuments,
  loadFx,
  loadHolidays,
  loadLedger,
  loadPolicy,
  loadSlaPerformance,
  loadTracker,
  loadUsage,
  loadVendorMaster,
} from "./data";
import { initialStateFor } from "./requestFlow";
import { evaluateSupplier, type RulesContext, type SupplierEvaluation } from "./rules/flags";
import { isCreditNote, rowsForVendor } from "./rules/ledger";
import {
  ExtractionOutputSchema,
  RateLineSchema,
  SlaTermsSchema,
  VendorQuoteSchema,
  isSlaTracked,
  type Category,
  type DevGoldSupplier,
  type DocumentMeta,
  type ExtractionOutput,
  type FamilyMember,
  type Field,
  type Request,
} from "./types";

export const SEED_CONFIDENCE = 0.95;

/** Extraction output plus the extra AI-extracted facts the Rules need (quote, rate card). */
export const SupplierExtractionSchema = ExtractionOutputSchema.extend({
  quote: VendorQuoteSchema.optional(),
  rate_card: z.array(RateLineSchema).optional(),
  /** v3: SLA terms from the executed contract (null = no % service level). */
  sla_terms: SlaTermsSchema.nullable().optional(),
  /** v3: licensed units per line from the order form. */
  licensed_units: z.array(z.object({ metric: z.string(), licensed_units: z.number(), doc_id: z.string().optional() })).optional(),
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
  // v3: SLA terms and order-form licensed units come from gold for now (AI extraction replaces this source later).
  const perf = isSlaTracked(g.performance) ? g.performance.sla_terms : null;
  const licensed = g.utilisation?.lines.map((l) => ({ metric: l.metric, licensed_units: l.licensed_units, doc_id: g.utilisation!.order_form }));
  return { supplier_id: g.supplier_id, family: g.family, effective_terms: terms, quote: g.quote, rate_card: g.rate_card, sla_terms: perf, licensed_units: licensed, source: "seed" };
}

let ctxPromise: Promise<RulesContext> | null = null;
export function loadRulesContext(): Promise<RulesContext> {
  ctxPromise ??= (async () => {
    const [policy, benchmarks, holidays, ledger, tracker, fx, cpi, sla, usage, vendors] = await Promise.all([
      loadPolicy(),
      loadBenchmarks(),
      loadHolidays(),
      loadLedger(),
      loadTracker(),
      loadFx(),
      loadCpi(),
      loadSlaPerformance(),
      loadUsage(),
      loadVendorMaster(),
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
      sla,
      usage,
      vendors,
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

export type FamilyDoc = FamilyMember & {
  meta: DocumentMeta | null;
  /** Grouping evidence from doc_supplier_map (CIN/GSTIN/envelope/cross-reference). */
  grouping_evidence: string[];
  /** Effective-term fields this document supplies (it "wins" for these). */
  governs: string[];
};

/**
 * Family = documents assigned to this supplier in doc_supplier_map (grouping truth until AI grouping ships),
 * enriched with the extraction's role/executed/evidence and documents.json metadata.
 */
async function buildFamily(supplierId: string, ex: SupplierExtraction): Promise<FamilyDoc[]> {
  const [gold, docs] = await Promise.all([loadDevGold(), loadDocuments()]);
  const map = (gold.doc_supplier_map ?? []).filter((m) => m.supplier_id === supplierId);
  const ids = map.length ? map.map((m) => m.doc_id) : ex.family.map((f) => f.doc_id);
  const leaves = Object.entries(ex.effective_terms).flatMap(([k, v]) =>
    k === "uplift" ? Object.entries(v as Record<string, Field<unknown>>).map(([kk, vv]) => [`uplift.${kk}`, vv] as const) : [[k, v as Field<unknown>] as const],
  );
  const ORDER = ["msa", "sow", "order_form", "amendment", "quote", "email", "other"];
  return ids
    .map((doc_id) => {
      const f = ex.family.find((x) => x.doc_id === doc_id) ?? { doc_id, doc_role: "other" as const, executed: "unknown" as const, execution_evidence: [], references: [] };
      return {
        ...f,
        meta: docs.find((d) => d.doc_id === doc_id) ?? null,
        grouping_evidence: map.find((m) => m.doc_id === doc_id)?.evidence ?? [],
        governs: leaves.filter(([, l]) => (l.overridden_by ?? l.citation?.doc_id) === doc_id).map(([k]) => k),
      };
    })
    .sort((a, b) => ORDER.indexOf(a.doc_role) - ORDER.indexOf(b.doc_role) || a.doc_id.localeCompare(b.doc_id));
}

export type SupplierView = SupplierMeta & {
  source: "seed" | "cache";
  terms: ExtractionOutput["effective_terms"];
  family: FamilyDoc[];
  trackerRow: SupplierEvaluation["trackerRow"];
  ledgerMonths: { period: string; amount: number }[];
  flags: SupplierEvaluation["flags"];
  lane: SupplierEvaluation["lane"];
  laneReason: string;
  actBy: SupplierEvaluation["actBy"];
  money: Pick<SupplierEvaluation, "annualInr" | "monthlyInr" | "uplift" | "earliestExit"> & { currency: string };
  benchmarks: SupplierEvaluation["benchmarks"];
  ledgerSummary: SupplierEvaluation["ledger"]["summary"];
  trackerConflicts: SupplierEvaluation["trackerConflicts"];
  sla: SupplierEvaluation["sla"];
  utilisation: SupplierEvaluation["utilisation"];
};

export async function getSupplierView(supplierId: string): Promise<SupplierView | null> {
  const meta = (await listSuppliers()).find((s) => s.supplierId === supplierId);
  const ex = await getExtraction(supplierId);
  if (!meta || !ex) return null;
  const ev = evaluateSupplier(
    {
      supplierId,
      name: meta.name,
      category: meta.category,
      terms: ex.effective_terms,
      quote: ex.quote,
      rateCard: ex.rate_card,
      vendorId: meta.vendorId,
      slaTerms: ex.sla_terms ?? null,
      licensed: ex.licensed_units,
    },
    await loadRulesContext(),
  );
  const cur = ex.effective_terms.currency.value;
  const ctx = await loadRulesContext();
  const months = new Map<string, number>();
  for (const r of rowsForVendor(ctx.ledger, meta.name).filter((r) => !isCreditNote(r))) months.set(r.service_period, (months.get(r.service_period) ?? 0) + r.amount_pre_tax_inr);
  return {
    ...meta,
    source: ex.source,
    terms: ex.effective_terms,
    family: await buildFamily(supplierId, ex),
    trackerRow: ev.trackerRow,
    ledgerMonths: [...months.entries()].sort().map(([period, amount]) => ({ period, amount })),
    flags: ev.flags,
    lane: ev.lane,
    laneReason: ev.laneReason,
    actBy: ev.actBy,
    money: { annualInr: ev.annualInr, monthlyInr: ev.monthlyInr, uplift: ev.uplift, earliestExit: ev.earliestExit, currency: typeof cur === "string" && cur !== "unclear" ? cur : "INR" },
    benchmarks: ev.benchmarks,
    ledgerSummary: ev.ledger.summary,
    trackerConflicts: ev.trackerConflicts,
    sla: ev.sla,
    utilisation: ev.utilisation,
  };
}

export async function getAllSupplierViews(): Promise<SupplierView[]> {
  const views = await Promise.all((await listSuppliers()).map((s) => getSupplierView(s.supplierId)));
  return views.filter((v): v is SupplierView => !!v);
}

/** Initial requests Docket raises itself: owner_pending (amber/red), human_review (unclear), auto_logged (green). */
export function buildInitialRequests(views: SupplierView[]): Request[] {
  const ts = `${DEMO_TODAY}T09:00:00.000Z`;
  return views.map((v) => ({
    id: `REQ-${v.supplierId}`,
    supplier_id: v.supplierId,
    supplier_name: v.name,
    category: v.category,
    state: initialStateFor(v.lane),
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
