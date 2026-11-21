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

/** Usage / SLA metric names from usage.csv and sla_performance.csv, in plain words. */
const METRIC_LABEL: Record<string, string> = {
  named_users_sales_cloud: "Sales Cloud seats",
  agents_service_desk: "Service Desk agents",
  active_employees: "employee licences",
  uptime_pct: "uptime",
  availability_pct: "availability",
  on_time_delivery_pct: "on-time delivery",
  control_plane_availability_pct: "control-plane availability",
  guard_shift_coverage_pct: "guard-shift coverage",
  ill_uptime_pct: "ILL circuit uptime",
};
export const metricLabel = (m: string) => METRIC_LABEL[m.split(":")[0]] ?? m.replace(/_/g, " ");

/** ₹14,57,544 → "₹14.6L" (one decimal, for plain-language lines). */
export const lakh1 = (n: number) => (Math.abs(n) >= 1e5 ? `₹${(n / 1e5).toFixed(1)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`);

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-08" → "Aug 2026" */
export const monthLabel = (p: string) => `${MON[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

/** ["2026-08","2026-09"] → "Aug + Sep 2026" */
export function monthList(ms: string[]): string {
  const byYear = new Map<string, string[]>();
  for (const m of [...ms].sort()) byYear.set(m.slice(0, 4), [...(byYear.get(m.slice(0, 4)) ?? []), MON[Number(m.slice(5, 7)) - 1]]);
  return [...byYear.entries()].map(([y, names]) => `${names.join(" + ")} ${y}`).join(", ");
}
