/**
 * Pure post-processing of the extraction LLM output (no SDK, no I/O; unit-tested):
 *  1. VERIFY every cited quote against the cited document's cleaned text / OCR text (guardrail 1).
 *     A failed quote turns the value into "unclear" with confidence 0 (→ human review).
 *  2. OCR-sourced values: confidence capped at 0.8 (→ human review).
 *  3. PRECEDENCE in code: only executed documents count; later documents in precedence order win per field;
 *     a winning executed amendment that overrides an earlier value is recorded as overridden_by.
 * The LLM never resolves precedence across documents and never does arithmetic.
 */
import { z } from "zod";
import { verifyQuote } from "./guardrails";
import {
  CreditBandSchema,
  DocRoleSchema,
  type Citation,
  type EffectiveTerms,
  type FamilyMember,
  type Field,
  type RateLine,
  type SlaTerms,
  type VendorQuote,
} from "../types";

export const FIELD_KEYS = [
  "renewal_type",
  "initial_term_end",
  "renewal_term_months",
  "notice_days",
  "notice_day_type",
  "notice_method",
  "notice_address",
  "uplift.type",
  "uplift.value_pct",
  "uplift.cap_pct",
  "tfc",
  "tfc_notice_days",
  "payment_terms_days",
  "sla_credits",
  "currency",
  "governing_law",
  "annual_value",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];
/** Extra keys the model may report that are not effective terms themselves (Rules derive a term from them). */
export const AUX_KEYS = ["monthly_value"] as const;
const LLM_KEYS = [...FIELD_KEYS, ...AUX_KEYS] as const;
type LlmKey = (typeof LLM_KEYS)[number];

export const OCR_CONFIDENCE_CAP = 0.8;

/* ------------------------------------------------------------------ */
/* LLM output schema (what Claude returns; validated with zod)          */
/* ------------------------------------------------------------------ */

const LlmCitationSchema = z.object({ doc_id: z.string(), section: z.string(), quote: z.string() });

const LlmFieldSchema = z.object({
  key: z.enum(LLM_KEYS),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  confidence: z.number().min(0).max(1),
  citation: LlmCitationSchema.nullable(),
  note: z.string().nullable().optional(),
});

export const ExtractionLlmSchema = z.object({
  family: z.array(
    z.object({
      doc_id: z.string(),
      doc_role: DocRoleSchema,
      executed: z.union([z.boolean(), z.literal("unknown")]),
      execution_evidence: z.array(z.string()),
      references: z.array(z.string()),
      /** Signature / effective date as written, normalised to yyyy-mm-dd (ordering only). */
      signed_date: z.string().nullable(),
    }),
  ),
  documents: z.array(
    z.object({
      doc_id: z.string(),
      fields: z.array(LlmFieldSchema),
      rate_lines: z
        .array(
          z.object({
            role_in_contract: z.string(),
            benchmark_role: z.string().nullable(),
            count: z.number().nullable(),
            rate_inr_per_hr: z.number(),
            citation: LlmCitationSchema,
          }),
        )
        .default([]),
    }),
  ),
  not_stated: z.array(z.object({ key: z.enum(FIELD_KEYS), confidence: z.number().min(0).max(1), reason: z.string() })).default([]),
  quote: z
    .object({ doc_id: z.string(), proposed_annual_inr: z.number().nullable(), proposed_uplift_pct: z.number().nullable(), citation: LlmCitationSchema })
    .nullable()
    .default(null),
  sla_terms: z
    .object({
      metric: z.string(),
      target: z.number(),
      currency: z.string(),
      credit_rule: z.union([z.array(CreditBandSchema), z.string()]),
      credit_basis: z.enum(["monthly_fees", "per_unit_charge", "other"]),
      citation: LlmCitationSchema,
    })
    .nullable()
    .default(null),
  licensed_units: z.array(z.object({ metric: z.string(), licensed_units: z.number(), citation: LlmCitationSchema })).default([]),
});
export type ExtractionLlm = z.infer<typeof ExtractionLlmSchema>;

/* ------------------------------------------------------------------ */
/* Value coercion per field                                             */
/* ------------------------------------------------------------------ */

const ENUMS: Partial<Record<LlmKey, readonly string[]>> = {
  renewal_type: ["auto", "evergreen", "manual", "none"],
  notice_day_type: ["calendar", "business"],
  "uplift.type": ["fixed", "cpi", "greater_of", "discretionary", "none"],
};
const NUMBERS = new Set<LlmKey>(["renewal_term_months", "notice_days", "uplift.value_pct", "uplift.cap_pct", "tfc_notice_days", "payment_terms_days", "annual_value", "monthly_value"]);
const BOOLEANS = new Set<LlmKey>(["tfc", "sla_credits"]);

/** Coerces an LLM value to the field's type; returns "unclear" when it can't (never guesses). */
export function coerceValue(key: LlmKey, v: string | number | boolean | null): string | number | boolean | null | "unclear" {
  if (v === null) return null;
  if (typeof v === "string" && v.trim().toLowerCase() === "unclear") return "unclear";
  if (NUMBERS.has(key)) {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[,₹\s]/g, "")) : NaN;
    return Number.isFinite(n) ? n : "unclear";
  }
  if (BOOLEANS.has(key)) {
    if (typeof v === "boolean") return v;
    const s = String(v).toLowerCase();
    return s === "true" || s === "yes" ? true : s === "false" || s === "no" ? false : "unclear";
  }
  const s = String(v).trim();
  if (ENUMS[key]) return ENUMS[key]!.includes(s.toLowerCase()) ? s.toLowerCase() : "unclear";
  if (key === "initial_term_end") return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "unclear";
  return s;
}

/* ------------------------------------------------------------------ */
/* Verification                                                         */
/* ------------------------------------------------------------------ */

export type DocText = { text: string; ocr: boolean };
export type VerificationRecord = { key: string; doc_id: string; section: string; quote: string; ok: boolean; reason?: string };

export function verifyCitation(c: Citation | null | undefined, docs: ReadonlyMap<string, DocText>): { ok: boolean; reason?: string; ocr: boolean } {
  if (!c) return { ok: false, reason: "no citation", ocr: false };
  const d = docs.get(c.doc_id);
  if (!d) return { ok: false, reason: `cited ${c.doc_id} is not in this supplier's family`, ocr: false };
  if (!d.text.trim()) return { ok: false, reason: `${c.doc_id} has no text (OCR failed)`, ocr: d.ocr };
  return verifyQuote(d.text, c.quote) ? { ok: true, ocr: d.ocr } : { ok: false, reason: "quote not found in document text", ocr: d.ocr };
}

/* ------------------------------------------------------------------ */
/* Precedence                                                           */
/* ------------------------------------------------------------------ */

/** Base rank: ancillary docs < MSA < SOW / order form < amendment. Ties broken by signed date. */
const RANK: Record<string, number> = { other: 0, email: 0, quote: 0, msa: 1, sow: 2, order_form: 2, amendment: 3 };

/**
 * Executed documents in precedence order. Of several executed SOWs (or order forms), only the latest signed one
 * is current; earlier ones are treated as superseded (e.g. an expired SOW-1 that opted out of renewal must not
 * override the MSA for the relationship). Simplification: Docket tracks one renewal per supplier relationship.
 */
export function precedenceOrder(family: ExtractionLlm["family"]): string[] {
  const latest = (role: string) =>
    family
      .filter((f) => f.executed === true && f.doc_role === role)
      .sort((a, b) => (a.signed_date ?? "").localeCompare(b.signed_date ?? "") || a.doc_id.localeCompare(b.doc_id))
      .at(-1)?.doc_id;
  const current = { sow: latest("sow"), order_form: latest("order_form") } as Record<string, string | undefined>;
  return family
    .filter((f) => f.executed === true)
    .filter((f) => !(f.doc_role in current) || current[f.doc_role] === f.doc_id)
    .slice()
    .sort((a, b) => (RANK[a.doc_role] ?? 0) - (RANK[b.doc_role] ?? 0) || (a.signed_date ?? "").localeCompare(b.signed_date ?? "") || a.doc_id.localeCompare(b.doc_id))
    .map((f) => f.doc_id);
}

type AnyField = Field<unknown>;

export type MergeResult = {
  family: FamilyMember[];
  effective_terms: EffectiveTerms;
  quote?: VendorQuote;
  rate_card?: RateLine[];
  sla_terms: SlaTerms | null;
  licensed_units: { metric: string; licensed_units: number; doc_id?: string }[];
  verification: VerificationRecord[];
  /** Field keys sourced from OCR text. */
  ocrFields: string[];
};

export function mergeExtraction(llm: ExtractionLlm, docs: ReadonlyMap<string, DocText>, familyIds: string[]): MergeResult {
  const verification: VerificationRecord[] = [];
  const inFamily = new Set(familyIds);
  const family = llm.family.filter((f) => inFamily.has(f.doc_id));
  const order = precedenceOrder(family);
  const executed = new Set(order);
  const roleOf = (id: string) => family.find((f) => f.doc_id === id)?.doc_role;

  // 1. verify every cited field, per document
  type Candidate = { docId: string; field: AnyField };
  const byKey = new Map<LlmKey, Candidate[]>();
  for (const d of llm.documents) {
    if (!inFamily.has(d.doc_id)) continue;
    for (const f of d.fields) {
      let value = coerceValue(f.key, f.value);
      let confidence = f.confidence;
      let note = f.note ?? undefined;
      let verified: boolean | undefined;
      let ocr = docs.get(d.doc_id)?.ocr ?? false;
      if (f.citation) {
        const v = verifyCitation(f.citation, docs);
        verified = v.ok;
        ocr = v.ocr;
        verification.push({ key: f.key, doc_id: f.citation.doc_id, section: f.citation.section, quote: f.citation.quote, ok: v.ok, reason: v.reason });
        if (!v.ok && value !== null && value !== "unclear") {
          value = "unclear";
          confidence = 0;
          note = `Quote check failed: ${v.reason}`;
        }
      } else if (value !== null && value !== "unclear") {
        value = "unclear"; // guardrail 1: no citation, no value
        confidence = 0;
        note = "No citation given";
      }
      if (ocr) confidence = Math.min(confidence, OCR_CONFIDENCE_CAP);
      const field: AnyField = { value, confidence, citation: f.citation, ...(verified !== undefined ? { verified } : {}), ...(ocr ? { ocr: true } : {}), ...(note ? { note } : {}) };
      byKey.set(f.key, [...(byKey.get(f.key) ?? []), { docId: d.doc_id, field }]);
    }
  }

  // 2. precedence: walk executed docs in order; the last one that states the field wins
  const terms: Record<string, AnyField> = {};
  const ocrFields: string[] = [];
  for (const key of FIELD_KEYS) {
    const all = (byKey.get(key) ?? []).filter((c) => executed.has(c.docId)).sort((a, b) => order.indexOf(a.docId) - order.indexOf(b.docId));
    // A document that only says "not stated" (null) never overrides one that states a value.
    const stated = all.filter((c) => c.field.value !== null);
    const cands = stated.length ? stated : all;
    let win: AnyField | null = null;
    let winDoc: string | null = null;
    for (const c of cands) {
      const overrides: boolean = !!win && winDoc !== c.docId && roleOf(c.docId) === "amendment";
      win = overrides ? { ...c.field, overridden_by: c.docId } : c.field;
      winDoc = c.docId;
    }
    // Rules, not the LLM: annual value from a stated monthly charge (× 12) when no annual amount is written.
    if (key === "annual_value" && (!win || win.value === null)) {
      const mv = (byKey.get("monthly_value") ?? []).filter((c) => executed.has(c.docId) && typeof c.field.value === "number").sort((a, b) => order.indexOf(a.docId) - order.indexOf(b.docId)).at(-1);
      if (mv) win = { ...mv.field, value: Math.round((mv.field.value as number) * 12), note: `Rules: monthly ${mv.field.value} × 12 (annual not stated)` };
    }
    if (!win) {
      // Not stated in any executed document: null, with the model's confidence that it is absent.
      const ns = llm.not_stated.find((n) => n.key === key);
      const draftOnly = (byKey.get(key) ?? []).some((c) => !executed.has(c.docId));
      win = {
        value: null,
        confidence: ns ? ns.confidence : 0.5,
        citation: null,
        ...(ns ? {} : { note: draftOnly ? "Stated only in a non-executed document" : "Not reported by the model" }),
      };
    }
    if (win.ocr) ocrFields.push(key);
    terms[key] = win;
  }

  const effective_terms = {
    renewal_type: terms["renewal_type"],
    initial_term_end: terms["initial_term_end"],
    renewal_term_months: terms["renewal_term_months"],
    notice_days: terms["notice_days"],
    notice_day_type: terms["notice_day_type"],
    notice_method: terms["notice_method"],
    notice_address: terms["notice_address"],
    uplift: { type: terms["uplift.type"], value_pct: terms["uplift.value_pct"], cap_pct: terms["uplift.cap_pct"] },
    tfc: terms["tfc"],
    tfc_notice_days: terms["tfc_notice_days"],
    payment_terms_days: terms["payment_terms_days"],
    sla_credits: terms["sla_credits"],
    currency: terms["currency"],
    governing_law: terms["governing_law"],
    annual_value: terms["annual_value"],
  } as EffectiveTerms;

  // 3. rate card: per role, the latest executed document in precedence order wins (amendment revisions).
  const lines = new Map<string, RateLine>();
  const roleKey = (r: string) => r.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const docId of order) {
    for (const l of llm.documents.find((d) => d.doc_id === docId)?.rate_lines ?? []) {
      const v = verifyCitation(l.citation, docs);
      verification.push({ key: `rate:${l.role_in_contract}`, doc_id: l.citation.doc_id, section: l.citation.section, quote: l.citation.quote, ok: v.ok, reason: v.reason });
      if (!v.ok || !l.benchmark_role) continue;
      const prev = lines.get(roleKey(l.role_in_contract));
      const count = l.count ?? prev?.count;
      if (count == null) continue;
      lines.set(roleKey(l.role_in_contract), { role_in_contract: l.role_in_contract, benchmark_role: l.benchmark_role, count, rate_inr_per_hr: l.rate_inr_per_hr, citation: l.citation });
    }
  }

  // 4. vendor quote (F3) — only when its citation verifies and both numbers are stated.
  let quote: VendorQuote | undefined;
  if (llm.quote && llm.quote.proposed_uplift_pct != null && llm.quote.proposed_annual_inr != null) {
    const v = verifyCitation(llm.quote.citation, docs);
    verification.push({ key: "quote", doc_id: llm.quote.citation.doc_id, section: llm.quote.citation.section, quote: llm.quote.citation.quote, ok: v.ok, reason: v.reason });
    if (v.ok) quote = { doc_id: llm.quote.doc_id, proposed_annual_inr: llm.quote.proposed_annual_inr, proposed_uplift_pct: llm.quote.proposed_uplift_pct, citation: llm.quote.citation };
  }

  // 5. SLA terms (S1) and licensed units (U1) — fee basis is computed by Rules later, never by the LLM.
  let sla_terms: SlaTerms | null = null;
  if (llm.sla_terms) {
    const v = verifyCitation(llm.sla_terms.citation, docs);
    verification.push({ key: "sla_terms", doc_id: llm.sla_terms.citation.doc_id, section: llm.sla_terms.citation.section, quote: llm.sla_terms.citation.quote, ok: v.ok, reason: v.reason });
    if (v.ok) sla_terms = { ...llm.sla_terms, fee_basis_monthly: null };
  }
  const licensed_units = llm.licensed_units.flatMap((l) => {
    const v = verifyCitation(l.citation, docs);
    verification.push({ key: `licensed:${l.metric}`, doc_id: l.citation.doc_id, section: l.citation.section, quote: l.citation.quote, ok: v.ok, reason: v.reason });
    return v.ok ? [{ metric: l.metric, licensed_units: l.licensed_units, doc_id: l.citation.doc_id }] : [];
  });

  return {
    family: family.map((f) => ({ doc_id: f.doc_id, doc_role: f.doc_role, executed: f.executed, execution_evidence: f.execution_evidence, references: f.references })),
    effective_terms,
    ...(quote ? { quote } : {}),
    ...(lines.size ? { rate_card: [...lines.values()] } : {}),
    sla_terms,
    licensed_units,
    verification,
    ocrFields,
  };
}
