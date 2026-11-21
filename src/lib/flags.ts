import type { FlagCode, FlagSeverity } from "./types";

export type FlagMeta = {
  code: FlagCode;
  key: string;
  label: string;
  description: string;
  /** Default severity; the rules engine may escalate (e.g. F2/F6 above threshold). */
  severity: FlagSeverity;
};

export const FLAGS: Record<FlagCode, FlagMeta> = {
  F1: { code: "F1", key: "AUTO_RENEW_NOTICE", label: "Auto-renews", description: "Contract renews automatically unless notice is served by the act-by date.", severity: "info" },
  F2: { code: "F2", key: "UPLIFT_EXPOSURE", label: "Uplift exposure", description: "The renewal price uplift exceeds the category's uplift threshold.", severity: "material" },
  F3: { code: "F3", key: "QUOTE_EXCEEDS_CAP", label: "Quote over cap", description: "The supplier's renewal quote exceeds the price cap already in the contract.", severity: "material" },
  F4: { code: "F4", key: "RATE_ABOVE_BENCHMARK", label: "Above benchmark", description: "The rate sits above the category benchmark by more than the policy gap.", severity: "material" },
  F5: { code: "F5", key: "NO_SLA_CREDITS", label: "No SLA credits", description: "The contract has no service-credit remedy for missed SLAs.", severity: "minor" },
  F6: { code: "F6", key: "NO_TERMINATION_FOR_CONVENIENCE", label: "No TfC", description: "No termination-for-convenience right, where policy requires one.", severity: "material" },
  F7: { code: "F7", key: "PAYMENT_TERMS_BELOW_POLICY", label: "Short payment terms", description: "Payment terms are shorter than the category policy.", severity: "minor" },
  L1: { code: "L1", key: "SPEND_ABOVE_CONTRACT_VALUE", label: "Spend > contract", description: "Ledger spend over the term exceeds the contracted value.", severity: "material" },
  L2: { code: "L2", key: "PAID_AFTER_EXPIRY", label: "Paid after expiry", description: "Invoices were paid for service periods after the contract expired.", severity: "material" },
  L3: { code: "L3", key: "BILLING_DRIFT_ABOVE_CONTRACT", label: "Billing drift", description: "Billed amounts are above the contracted rate.", severity: "material" },
  L4: { code: "L4", key: "UNTRACKED_RECURRING_SPEND", label: "Untracked spend", description: "Recurring ledger spend with no contract in the tracker.", severity: "material" },
  T1: { code: "T1", key: "TRACKER_CONFLICT", label: "Tracker conflict", description: "The Excel tracker disagrees with the executed contract.", severity: "minor" },
  X1: { code: "X1", key: "UNCLEAR_CLAUSE", label: "Unclear clause", description: "A key clause could not be read with confidence; a human must confirm it.", severity: "review" },
  X2: { code: "X2", key: "SPECIAL_NOTICE_METHOD", label: "Special notice method", description: "Notice must be served by a specific method or to a specific address.", severity: "minor" },
};
