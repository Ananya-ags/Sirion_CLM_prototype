import type { RequestState } from "./types";

export const STATE_LABEL: Record<RequestState, string> = {
  raised: "Raised",
  human_review: "In review",
  owner_pending: "With owner",
  owner_decided: "Owner decided",
  procurement_review: "Procurement",
  legal_pending: "With Legal",
  sent: "Notice sent",
  renewed_logged: "Renewed",
  handoff_renegotiation: "Handed off",
  auto_logged: "Auto-logged",
  closed: "Closed",
};

export const TERMINAL: RequestState[] = ["sent", "renewed_logged", "handoff_renegotiation", "closed"];

export const CATEGORY_LABEL: Record<string, string> = {
  saas: "SaaS", staffing: "Staffing", facilities: "Facilities", logistics: "Logistics", marketing: "Marketing",
  cloud: "Cloud", security: "Security", telecom: "Telecom", training: "Training",
};

export const FIELD_LABEL: Record<string, string> = {
  renewal_type: "Renewal", initial_term_end: "Term ends", renewal_term_months: "Renewal term", notice_days: "Notice",
  notice_day_type: "Day type", notice_method: "Notice method", notice_address: "Notice address", "uplift.type": "Uplift",
  "uplift.value_pct": "Uplift %", "uplift.cap_pct": "Uplift cap", tfc: "Exit for convenience", tfc_notice_days: "TfC notice",
  payment_terms_days: "Payment terms", sla_credits: "SLA credits", currency: "Currency", governing_law: "Governing law", annual_value: "Annual value",
};

export const ROLE_LABEL: Record<string, string> = {
  msa: "MSA", sow: "SOW", amendment: "Amendment", order_form: "Order form", quote: "Quote", email: "Email", other: "Other",
};
