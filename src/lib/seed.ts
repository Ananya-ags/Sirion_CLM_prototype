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
  loadGrouping,
  loadHolidays,
  loadLedger,
  loadPolicy,
  loadSlaPerformance,
  loadTracker,
  loadUsage,
  loadVendorMaster,
} from "./data";
import { initialStateFor } from "./requestFlow";
import { SUPPLIER_REGISTER } from "./suppliers";
import { evaluateSupplier, type RulesContext, type SupplierEvaluation } from "./rules/flags";
import { isCreditNote, rowsForVendor } from "./rules/ledger";
import { withFeeBasis } from "./rules/performance";
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
  type HumanOverride,
  type Request,
} from "./types";
import { coerceValue, FIELD_KEYS, type FieldKey } from "./ai/precedence";

export const SEED_CONFIDENCE = 0.95;

/** Extraction output plus the extra AI-extracted facts the Rules need (quote, rate card). */
export const SupplierExtractionSchema = ExtractionOutputSchema.extend({
  quote: VendorQuoteSchema.optional(),
  rate_card: z.array(RateLineSchema).optional(),
  /** v3: SLA terms from the executed contract (null = no % service level). */
  sla_terms: SlaTermsSchema.nullable().optional(),
  /** v3: licensed units per line from the order form. */
  licensed_units: z.array(z.object({ metric: z.string(), licensed_units: z.number(), doc_id: z.string().optional() })).optional(),
  /** AI pipeline metadata (model, verification log, OCR docs). Absent for the gold seed. */
  pipeline: z
    .looseObject({
      model: z.string(),
      generated_at: z.string(),
      docs: z.array(z.object({ doc_id: z.string(), text_source: z.string() })).default([]),
      verification: z.array(z.object({ key: z.string(), doc_id: z.string(), ok: z.boolean() })).default([]),
      verification_failures: z.number().default(0),
    })
    .optional(),
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

/** "Nimbus CRM Private Limited" → "Nimbus CRM Pvt Ltd" (display only). */
export const displayName = (legal: string) => legal.replace(/\bPrivate Limited\b/i, "Pvt Ltd").replace(/\s+/g, " ").trim();

/** Suppliers Docket tracks: the supplier register (src/lib/suppliers.ts) joined to vendor_master.csv. Never gold. */
export async function listSuppliers(): Promise<SupplierMeta[]> {
  const vendors = await loadVendorMaster();
  return SUPPLIER_REGISTER.flatMap((r) => {
    const v = vendors.find((x) => x.vendor_id === r.vendor_id);
    return v ? [{ supplierId: r.supplier_id, name: displayName(v.legal_name), category: v.category, vendorId: v.vendor_id, erpVendorName: v.erp_vendor_name }] : [];
  });
}

/** Cached AI extraction wins; otherwise the gold seed (labelled "seed" in the UI). */
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
 * Family = documents the AI grouping assigned to this supplier (seed fallback: dev_gold doc_supplier_map),
 * enriched with the extraction's role/executed/evidence and documents.json metadata.
 */
async function buildFamily(supplierId: string, ex: SupplierExtraction): Promise<FamilyDoc[]> {
  const [docs, grouping] = await Promise.all([loadDocuments(), loadGrouping()]);
  // AI grouping when the extraction came from the pipeline; the gold map is read ONLY for the seed fallback.
  const map =
    ex.source === "cache" && grouping
      ? grouping.assignments.filter((a) => a.supplier_id === supplierId && a.status === "assigned").map((a) => ({ doc_id: a.doc_id, evidence: a.evidence }))
      : ((await loadDevGold()).doc_supplier_map ?? []).filter((m) => m.supplier_id === supplierId);
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
  /** AI pipeline summary (null for the seed fallback). */
  pipeline: { model: string; generatedAt: string; quotesChecked: number; quotesFailed: number; ocrDocs: string[] } | null;
  /** Fields a human must look at: "unclear" or confidence below policy (cited quote included). */
  reviewFields: ReviewField[];
};

export type ReviewField = { key: string; value: unknown; confidence: number; citation: Field<unknown>["citation"]; note?: string; ocr?: boolean; reason: string };

export function reviewFieldsOf(terms: ExtractionOutput["effective_terms"], minConfidence: number): ReviewField[] {
  const leaves = Object.entries(terms).flatMap(([k, v]) =>
    k === "uplift" ? Object.entries(v as Record<string, Field<unknown>>).map(([kk, vv]) => [`uplift.${kk}`, vv] as const) : [[k, v as Field<unknown>] as const],
  );
  return leaves
    .filter(([, f]) => f.value === "unclear" || f.confidence < minConfidence)
    .map(([key, f]) => ({
      key,
      value: f.value,
      confidence: f.confidence,
      citation: f.citation,
      ...(f.note ? { note: f.note } : {}),
      ...(f.ocr ? { ocr: true } : {}),
      reason: f.value === "unclear" ? (f.verified === false ? "Quote not found in the document" : "Unclear in the contract") : f.ocr ? "From OCR (scan): confidence capped at 0.8" : `Confidence ${f.confidence.toFixed(2)} below ${minConfidence}`,
    }));
}

/** Applies human overrides (confirm keeps the value, correct replaces it) as source:"human", confidence 1.0. */
export function applyOverrides(terms: ExtractionOutput["effective_terms"], overrides: HumanOverride[]): ExtractionOutput["effective_terms"] {
  const t = structuredClone(terms) as unknown as Record<string, Field<unknown> | Record<string, Field<unknown>>>;
  for (const o of overrides) {
    if (!(FIELD_KEYS as readonly string[]).includes(o.key)) continue;
    const [a, b] = o.key.split(".");
    const holder = (b ? t[a] : t) as Record<string, Field<unknown>>;
    const leaf = b ?? a;
    const f = holder[leaf];
    const value = o.action === "corrected" && o.value !== undefined ? coerceValue(o.key as FieldKey, o.value) : f.value;
    holder[leaf] = { ...f, value, confidence: 1, source: "human", note: o.action === "corrected" ? `Corrected by Procurement (was ${JSON.stringify(f.value)})` : "Confirmed by Procurement" };
  }
  return t as unknown as ExtractionOutput["effective_terms"];
}

export async function getSupplierView(supplierId: string, overrides: HumanOverride[] = []): Promise<SupplierView | null> {
  const meta = (await listSuppliers()).find((s) => s.supplierId === supplierId);
  const raw = await getExtraction(supplierId);
  if (!meta || !raw) return null;
  const ex = overrides.length ? { ...raw, effective_terms: applyOverrides(raw.effective_terms, overrides) } : raw;
  const annualOriginal = typeof ex.effective_terms.annual_value.value === "number" ? ex.effective_terms.annual_value.value : null;
  const slaTerms = ex.sla_terms ? withFeeBasis(ex.sla_terms, annualOriginal) : null;
  const ev = evaluateSupplier(
    {
      supplierId,
      name: meta.name,
      category: meta.category,
      terms: ex.effective_terms,
      quote: ex.quote,
      rateCard: ex.rate_card,
      vendorId: meta.vendorId,
      slaTerms,
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
    pipeline: ex.pipeline
      ? {
          model: ex.pipeline.model,
          generatedAt: ex.pipeline.generated_at,
          quotesChecked: ex.pipeline.verification.length,
          quotesFailed: ex.pipeline.verification_failures,
          ocrDocs: ex.pipeline.docs.filter((d) => d.text_source === "ocr").map((d) => d.doc_id),
        }
      : null,
    reviewFields: ex.source === "cache" ? reviewFieldsOf(ex.effective_terms, ctx.policy.global.confidence_min) : [],
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
