/**
 * "What Docket checks": the single catalogue of all 16 flags. FlagChip tooltips, the Policy page table and
 * FLAGS (lib/flags.ts) all read from here. Thresholds come from policy.json when a policy is passed in.
 */
import type { FlagCode, FlagSeverity, GlobalPolicy } from "./types";

export type FlagGroup = "Contract terms" | "Billing" | "Performance & usage" | "Data quality";
export type FlagSource = "AI-extracted terms" | "AP ledger" | "SLA & usage reports" | "Tracker";

export type CatalogEntry = {
  code: FlagCode;
  key: string;
  /** Short name. */
  label: string;
  group: FlagGroup;
  source: FlagSource;
  /** Default severity; the rules engine may escalate (e.g. F2/F6 above threshold). */
  severity: FlagSeverity;
  /** One line, plain English; uses policy thresholds when given. */
  describe: (g?: GlobalPolicy) => string;
};

const cat = "the category's threshold (see table below)";

export const FLAG_GROUPS: FlagGroup[] = ["Contract terms", "Billing", "Performance & usage", "Data quality"];

export const FLAG_CATALOG: CatalogEntry[] = [
  { code: "F1", key: "AUTO_RENEW_NOTICE", label: "Auto-renews", group: "Contract terms", source: "AI-extracted terms", severity: "info",
    describe: (g) => `Renews automatically unless notice is served by the act-by date${g ? `; red at ≤ ${g.red_days_to_act_by} days to act-by` : ""}.` },
  { code: "F2", key: "UPLIFT_EXPOSURE", label: "Uplift exposure", group: "Contract terms", source: "AI-extracted terms", severity: "material",
    describe: (g) => `The renewal price uplift exceeds ${g ? cat : "the category's uplift threshold"}.` },
  { code: "F3", key: "QUOTE_EXCEEDS_CAP", label: "Quote over cap", group: "Contract terms", source: "AI-extracted terms", severity: "material",
    describe: () => "The supplier's renewal quote exceeds the price cap already in the contract." },
  { code: "F4", key: "RATE_ABOVE_BENCHMARK", label: "Above benchmark", group: "Contract terms", source: "AI-extracted terms", severity: "material",
    describe: (g) => `The rate is above the category benchmark by more than ${g ? cat : "the policy gap"}.` },
  { code: "F5", key: "NO_SLA_CREDITS", label: "No SLA credits", group: "Contract terms", source: "AI-extracted terms", severity: "minor",
    describe: () => "The contract has no service-credit remedy for missed SLAs." },
  { code: "F6", key: "NO_TERMINATION_FOR_CONVENIENCE", label: "No TfC", group: "Contract terms", source: "AI-extracted terms", severity: "material",
    describe: () => "No termination-for-convenience right, where the category policy requires one." },
  { code: "F7", key: "PAYMENT_TERMS_BELOW_POLICY", label: "Short payment terms", group: "Contract terms", source: "AI-extracted terms", severity: "minor",
    describe: (g) => `Payment terms are shorter than ${g ? cat : "the category policy"}.` },
  { code: "X2", key: "SPECIAL_NOTICE_METHOD", label: "Special notice method", group: "Contract terms", source: "AI-extracted terms", severity: "minor",
    describe: () => "Notice must be served by a specific method or to a specific address (e.g. registered post)." },
  { code: "L1", key: "SPEND_ABOVE_CONTRACT_VALUE", label: "Spend > contract", group: "Billing", source: "AP ledger", severity: "material",
    describe: (g) => `Ledger spend over the term exceeds the contracted value${g ? ` by more than ${g.l1_overspend_tolerance_pct}%` : ""}.` },
  { code: "L2", key: "PAID_AFTER_EXPIRY", label: "Paid after expiry", group: "Billing", source: "AP ledger", severity: "material",
    describe: () => "Invoices were paid for service periods after the contract expired." },
  { code: "L3", key: "BILLING_DRIFT_ABOVE_CONTRACT", label: "Billing drift", group: "Billing", source: "AP ledger", severity: "material",
    describe: (g) => (g ? `Billed more than ${g.l3_drift_tolerance_pct}% above the contracted rate for ${g.l3_min_consecutive_months}+ months in a row.` : "Billed amounts are above the contracted rate.") },
  { code: "L4", key: "UNTRACKED_RECURRING_SPEND", label: "Untracked spend", group: "Billing", source: "AP ledger", severity: "material",
    describe: (g) => `Recurring ledger spend${g ? ` (${g.l4_min_recurring_months}+ months)` : ""} with no contract in the tracker.` },
  { code: "S1", key: "SLA_CREDIT_UNCLAIMED", label: "SLA credit unclaimed", group: "Performance & usage", source: "SLA & usage reports", severity: "minor",
    describe: (g) => `The supplier missed its SLA and the contractual credit wasn't claimed (no credit note)${g ? `; red at ${g.sla_breach_months_red}+ breach months on a critical vendor` : ""}.` },
  { code: "U1", key: "LOW_UTILISATION", label: "Low utilisation", group: "Performance & usage", source: "SLA & usage reports", severity: "minor",
    describe: (g) => (g ? `Under ${g.utilisation_flag_pct}% of licences in use for ${g.utilisation_min_months}+ months in a row.` : "Active users are below the utilisation threshold for several months in a row.") },
  { code: "T1", key: "TRACKER_CONFLICT", label: "Tracker conflict", group: "Data quality", source: "Tracker", severity: "minor",
    describe: () => "The Excel tracker disagrees with the executed contract." },
  { code: "X1", key: "UNCLEAR_CLAUSE", label: "Unclear clause", group: "Data quality", source: "AI-extracted terms", severity: "review",
    describe: () => "A key clause is unclear, unverified or read by OCR; a human must confirm it." },
];

export const CATALOG_BY_CODE = Object.fromEntries(FLAG_CATALOG.map((e) => [e.code, e])) as Record<FlagCode, CatalogEntry>;

/** Effect on the lane: minor flags per policy.global.minor_flags; X1 sends to human review; the rest can make red. */
export function flagEffect(e: CatalogEntry, g: GlobalPolicy): "Minor" | "Can make red" | "Needs review" {
  if (e.code === "X1") return "Needs review";
  return g.minor_flags.includes(e.code) ? "Minor" : "Can make red";
}
