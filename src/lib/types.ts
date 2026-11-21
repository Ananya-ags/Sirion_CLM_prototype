import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const PersonaIdSchema = z.enum(["procurement", "owner", "legal", "finance"]);
export type PersonaId = z.infer<typeof PersonaIdSchema>;

export const CategorySchema = z.enum([
  "saas",
  "staffing",
  "facilities",
  "logistics",
  "marketing",
  "cloud",
  "security",
  "telecom",
  "training",
]);
export type Category = z.infer<typeof CategorySchema>;

export const DocSourceSchema = z.enum(["sharepoint", "email", "docusign"]);
export type DocSource = z.infer<typeof DocSourceSchema>;

/** Every place a fact can come from (documents plus the two systems of record). */
export type SourceKind = DocSource | "tracker" | "ledger";

export const LaneSchema = z.enum(["green", "amber", "red", "needs_review"]);
export type Lane = z.infer<typeof LaneSchema>;

export type ActorKind = "AI" | "Rules" | "Human";
export type Actor = "AI" | "Rules" | PersonaId;

/** CSV helpers: empty cells become null; numbers tolerate "₹" and commas. */
const csvNumber = z.preprocess((v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/[₹,\s]/g, "");
  if (s === "") return null;
  return Number(s);
}, z.number().nullable());

const csvString = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}, z.string().nullable());

/* ------------------------------------------------------------------ */
/* Data files                                                          */
/* ------------------------------------------------------------------ */

export const DocumentSchema = z.object({
  doc_id: z.string(),
  supplier_id: z.string(),
  filename: z.string(),
  source: DocSourceSchema,
  source_path: z.string(),
  received_date: z.string(),
  file: z.string(),
});
export type DocumentMeta = z.infer<typeof DocumentSchema>;

export const TrackerRowSchema = z.object({
  tracker_id: z.string(),
  supplier_name: z.string(),
  contract_ref: csvString,
  /** Free text in the Excel tracker, e.g. "SaaS". */
  category: z.string(),
  owner: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  /** Raw tracker value: Y / N / TBC. */
  auto_renew: z.enum(["Y", "N", "TBC"]),
  notice_days: csvNumber,
  annual_value_inr: csvNumber,
  status: z.enum(["Active", "Expired"]),
  last_updated: z.string(),
});
export type TrackerRow = z.infer<typeof TrackerRowSchema>;

export const LedgerRowSchema = z.object({
  txn_id: z.string(),
  erp_vendor_name: z.string(),
  vendor_gstin: csvString,
  invoice_no: csvString,
  invoice_date: z.string(),
  /** yyyy-mm */
  service_period: z.string().regex(/^\d{4}-\d{2}$/),
  amount_pre_tax_inr: z.coerce.number(),
  gst_inr: z.coerce.number(),
  total_inr: z.coerce.number(),
  currency: z.enum(["INR", "USD"]),
  amount_original: z.coerce.number(),
  cost_centre: csvString,
  /** Empty for untracked spend (no PO). */
  po_ref: csvString,
});
export type LedgerRow = z.infer<typeof LedgerRowSchema>;

export const VendorMasterRowSchema = z.object({
  vendor_id: z.string(),
  legal_name: z.string(),
  erp_vendor_name: z.string(),
  gstin: csvString,
  category: CategorySchema,
  owner_persona: PersonaIdSchema,
  criticality: z.enum(["low", "medium", "high"]),
});
export type VendorMasterRow = z.infer<typeof VendorMasterRowSchema>;

export const CategoryPolicySchema = z.object({
  uplift_flag_pct: z.number(),
  benchmark_gap_pct: z.number(),
  min_comparables: z.number(),
  green_max_annual_value_inr: z.number(),
  payment_terms_policy_days: z.number(),
  tfc_required: z.boolean(),
  internal_buffer_days: z.number(),
});
export type CategoryPolicy = z.infer<typeof CategoryPolicySchema>;

export const GlobalPolicySchema = z.object({
  renewal_horizon_days: z.number(),
  red_days_to_act_by: z.number(),
  confidence_min: z.number(),
  auto_log_reversible_until_days_before_act_by: z.number(),
  l1_overspend_tolerance_pct: z.number(),
  l3_drift_tolerance_pct: z.number(),
  l3_min_consecutive_months: z.number(),
  l4_min_recurring_months: z.number(),
  notice_method_vocab: z.array(z.string()),
  special_notice_methods: z.array(z.string()),
  minor_flags: z.array(z.string()),
});
export type GlobalPolicy = z.infer<typeof GlobalPolicySchema>;

export const PolicySchema = z.object({
  demo_today: z.string().optional(),
  categories: z.partialRecord(CategorySchema, CategoryPolicySchema),
  global: GlobalPolicySchema,
});
export type Policy = z.infer<typeof PolicySchema>;

export const BenchmarkSchema = z.object({
  role: z.string(),
  rate_inr_per_hr: z.number(),
  source_supplier: z.string(),
});
export const BenchmarksSchema = z.array(BenchmarkSchema);
export type Benchmark = z.infer<typeof BenchmarkSchema>;

export const HolidaySchema = z.object({ date: z.string(), name: z.string() });
export type Holiday = z.infer<typeof HolidaySchema>;
export const HolidaysFileSchema = z.object({
  calendar: z.string(),
  business_day_rule: z.string(),
  holidays: z.array(HolidaySchema),
});
export type HolidaysFile = z.infer<typeof HolidaysFileSchema>;

export const FxSchema = z.object({ USD_INR: z.number() });
export type Fx = z.infer<typeof FxSchema>;

export const CpiSchema = z.object({ india_cpi_yoy_pct: z.number() });
export type Cpi = z.infer<typeof CpiSchema>;

export const PersonasFileSchema = z.array(
  z.looseObject({
    id: PersonaIdSchema,
    name: z.string(),
    full_name: z.string(),
    role: z.string(),
    default: z.boolean().optional(),
    sees: z.array(z.string()),
    hands_off: z.array(z.string()),
  }),
);
export type PersonaRecord = z.infer<typeof PersonasFileSchema>[number];

/* ------------------------------------------------------------------ */
/* Extraction output (AI, cited)                                       */
/* ------------------------------------------------------------------ */

export const CitationSchema = z.object({
  doc_id: z.string(),
  section: z.string(),
  quote: z.string(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const UNCLEAR = "unclear" as const;

/**
 * Every extracted leaf. `value` may be "unclear" (a valid answer) or null (not present).
 * `citation` is null only when the value is unclear or absent; guardrail 1 forbids using
 * a value without one (see isUsable).
 */
export function fieldSchema<T extends z.ZodType>(value: T) {
  return z.object({
    value: z.union([value, z.literal(UNCLEAR)]).nullable(),
    confidence: z.number().min(0).max(1),
    citation: CitationSchema.nullable(),
    overridden_by: z.string().optional(),
  });
}
export type Field<T> = {
  value: T | typeof UNCLEAR | null;
  confidence: number;
  citation: Citation | null;
  overridden_by?: string;
};

export const DocRoleSchema = z.enum(["msa", "sow", "amendment", "order_form", "quote", "email", "other"]);
export type DocRole = z.infer<typeof DocRoleSchema>;

export const FamilyMemberSchema = z.object({
  doc_id: z.string(),
  doc_role: DocRoleSchema,
  executed: z.union([z.boolean(), z.literal("unknown")]),
  execution_evidence: z.array(z.string()),
  references: z.array(z.string()),
});
export type FamilyMember = z.infer<typeof FamilyMemberSchema>;

export const RenewalTypeSchema = z.enum(["auto", "evergreen", "manual", "none", "unclear"]);
export const UpliftTypeSchema = z.enum(["fixed", "cpi", "greater_of", "discretionary", "none"]);

export const EffectiveTermsSchema = z.object({
  renewal_type: fieldSchema(RenewalTypeSchema),
  initial_term_end: fieldSchema(z.string()),
  renewal_term_months: fieldSchema(z.number()),
  notice_days: fieldSchema(z.number()),
  notice_day_type: fieldSchema(z.enum(["calendar", "business"])),
  notice_method: fieldSchema(z.string()),
  notice_address: fieldSchema(z.string()),
  uplift: z.object({
    type: fieldSchema(UpliftTypeSchema),
    value_pct: fieldSchema(z.number()),
    cap_pct: fieldSchema(z.number()),
  }),
  tfc: fieldSchema(z.boolean()),
  tfc_notice_days: fieldSchema(z.number()),
  payment_terms_days: fieldSchema(z.number()),
  sla_credits: fieldSchema(z.boolean()),
  currency: fieldSchema(z.string()),
  governing_law: fieldSchema(z.string()),
  annual_value: fieldSchema(z.number()),
});
export type EffectiveTerms = z.infer<typeof EffectiveTermsSchema>;

export const ExtractionOutputSchema = z.object({
  supplier_id: z.string(),
  family: z.array(FamilyMemberSchema),
  effective_terms: EffectiveTermsSchema,
});
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

/* ------------------------------------------------------------------ */
/* Gold sets                                                           */
/* ------------------------------------------------------------------ */

/** Dev gold: per supplier, the extraction shape plus expected Rules outputs. */
export const RateLineSchema = z.object({
  role_in_contract: z.string(),
  benchmark_role: z.string(),
  count: z.number(),
  rate_inr_per_hr: z.number(),
  citation: CitationSchema,
});
export type RateLine = z.infer<typeof RateLineSchema>;

export const VendorQuoteSchema = z.object({
  doc_id: z.string(),
  proposed_annual_inr: z.number(),
  proposed_uplift_pct: z.number(),
  citation: CitationSchema,
});
export type VendorQuote = z.infer<typeof VendorQuoteSchema>;

export const DevGoldSupplierSchema = z.looseObject({
  supplier_id: z.string(),
  contract_name: z.string(),
  erp_vendor_name: z.string(),
  vendor_id: z.string(),
  category: CategorySchema,
  tracker_id: z.string().nullable(),
  family: z.array(FamilyMemberSchema),
  effective_terms: EffectiveTermsSchema,
  /** Rules outputs the engine must reproduce (act-by, ₹ figures, ledger summary). */
  computed: z.looseObject({
    annual_value_inr: z.number(),
    monthly_contract_value_inr: z.number(),
    act_by_date: z.string().nullable(),
    days_to_act_by: z.number().nullable(),
    decision_target_date: z.string().optional(),
    effective_uplift_pct: z.number(),
    uplift_basis: z.string(),
    uplift_exposure_inr: z.number(),
  }),
  expected_flags: z.array(z.object({ code: z.string(), detail: z.unknown() })),
  expected_lane: LaneSchema,
  lane_reason: z.string(),
  quote: VendorQuoteSchema.optional(),
  rate_card: z.array(RateLineSchema).optional(),
});
export type DevGoldSupplier = z.infer<typeof DevGoldSupplierSchema>;
export const DevGoldFileSchema = z.looseObject({
  meta: z.record(z.string(), z.unknown()),
  suppliers: z.array(DevGoldSupplierSchema),
});
export type DevGoldFile = z.infer<typeof DevGoldFileSchema>;

/** Held-out gold: flat expected values per HO doc; never used for prompt tuning. */
export const HeldoutGoldItemSchema = z.looseObject({
  ho_id: z.string(),
  file: z.string(),
  kind: z.string(),
  fields: z.record(z.string(), z.unknown()),
  abstain_fields: z.array(z.string()),
});
export type HeldoutGoldItem = z.infer<typeof HeldoutGoldItemSchema>;
export const HeldoutGoldFileSchema = z.looseObject({
  meta: z.record(z.string(), z.unknown()),
  items: z.array(HeldoutGoldItemSchema),
});
export type HeldoutGoldFile = z.infer<typeof HeldoutGoldFileSchema>;

/* ------------------------------------------------------------------ */
/* Flags, requests, audit                                              */
/* ------------------------------------------------------------------ */

export const FlagCodeSchema = z.enum([
  "F1", "F2", "F3", "F4", "F5", "F6", "F7",
  "L1", "L2", "L3", "L4",
  "T1",
  "X1", "X2",
]);
export type FlagCode = z.infer<typeof FlagCodeSchema>;

export type FlagSeverity = "info" | "minor" | "material" | "review";

export type Flag = {
  code: FlagCode;
  severity: FlagSeverity;
  /** Short human detail, e.g. "Quote +9.0% vs cap 5.0%". Numbers come from Rules, never the LLM. */
  detail: string;
  evidence?: Citation[];
  /** ₹ at stake, computed by Rules. */
  impactInr?: number;
  /** Structured numbers behind the detail (for drawers, drafts and tests). */
  data?: Record<string, unknown>;
  /** e.g. T1 once a human has fixed the tracker. */
  resolved?: boolean;
};

export const RequestStateSchema = z.enum([
  "raised",
  "human_review",
  "owner_pending",
  "owner_decided",
  "procurement_review",
  "legal_pending",
  "sent",
  "renewed_logged",
  "handoff_renegotiation",
  "auto_logged",
  "closed",
]);
export type RequestState = z.infer<typeof RequestStateSchema>;

/** Allowed state moves (Rules). Anything else is rejected by the store. */
export const TRANSITIONS: Record<RequestState, RequestState[]> = {
  raised: ["human_review", "owner_pending", "procurement_review", "auto_logged"],
  human_review: ["raised", "owner_pending", "procurement_review", "auto_logged"],
  owner_pending: ["owner_decided"],
  owner_decided: ["procurement_review", "renewed_logged"],
  procurement_review: ["legal_pending", "renewed_logged", "handoff_renegotiation"],
  legal_pending: ["sent", "procurement_review"],
  sent: ["closed"],
  renewed_logged: ["closed"],
  handoff_renegotiation: ["closed"],
  auto_logged: ["closed", "owner_pending", "procurement_review"],
  closed: [],
};

export function canTransition(from: RequestState, to: RequestState): boolean {
  return TRANSITIONS[from].includes(to);
}

export type OwnerChoice = "renew" | "exit" | "procurement";

export type Request = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  category: Category | null;
  state: RequestState;
  lane: Lane | null;
  flags: Flag[];
  /** Last date to serve notice (Rules). ISO yyyy-mm-dd. */
  act_by: string | null;
  /** act_by minus the internal buffer (Rules). */
  internal_by: string | null;
  annual_value_inr: number | null;
  owner: PersonaId;
  raised_at: string;
  updated_at: string;
  lane_reason?: string;
  owner_decision?: { choice: OwnerChoice; reason: string; answers?: Record<string, string> };
};

export type AuditEntry = {
  id: string;
  ts: string;
  requestId: string | null;
  actor: Actor;
  action: string;
  reason: string;
};

export type FinanceConfirmation = {
  alertId: string;
  requestId: string;
  flagCode: FlagCode;
  confirmedBy: PersonaId;
  ts: string;
  note?: string;
};
