import type { GlobalPolicy, PersonaId } from "./types";

/** Fixed demo clock. All date maths uses this, never the real "today". */
export const DEMO_TODAY = "2026-11-25";
export const DEMO_TODAY_LABEL = "25 Nov 2026";

/** Demo timestamp: DEMO_TODAY's date combined with the real wall-clock time (for audit ordering). */
export function demoNowISO(): string {
  const now = new Date();
  const time = now.toISOString().slice(11); // HH:mm:ss.sssZ
  return `${DEMO_TODAY}T${time}`;
}

export const FX = { USD_INR: 84 } as const;
export const CPI_INDIA_YOY_PCT = 5.2;

/** Internal buffer = act-by minus this many days. */
export const INTERNAL_BUFFER_DAYS = 15;
/** Green-lane auto-log is reversible until act-by minus this many days. */
export const GREEN_REVERSIBLE_DAYS = 7;
/** At or under this many days to act-by, the request is Red. */
export const RED_URGENT_DAYS = 14;
/** Key fields below this confidence go to human review. */
export const CONFIDENCE_THRESHOLD = 0.85;

/** Used only if policy.json is missing; mirrors its "global" block. */
export const DEFAULT_GLOBAL_POLICY: GlobalPolicy = {
  renewal_horizon_days: 180,
  red_days_to_act_by: RED_URGENT_DAYS,
  confidence_min: CONFIDENCE_THRESHOLD,
  auto_log_reversible_until_days_before_act_by: GREEN_REVERSIBLE_DAYS,
  l1_overspend_tolerance_pct: 10,
  l3_drift_tolerance_pct: 5,
  l3_min_consecutive_months: 3,
  l4_min_recurring_months: 3,
  notice_method_vocab: ["email", "email_or_physical", "email_and_physical", "registered_post", "physical_only"],
  special_notice_methods: ["registered_post", "physical_only", "email_and_physical"],
  minor_flags: ["F5", "F7", "X2", "T1", "S1", "U1"],
  sla_breach_months_red: 3,
  utilisation_flag_pct: 80,
  utilisation_min_months: 3,
};

/** Staffing rate cards: planned hours per resource per month (from the data pack's build script). */
export const PLANNED_HOURS_PER_RESOURCE_MONTH = 150;

/** Claude model names (server-side only). Override with env vars without code changes. */
export const MODELS = {
  draft: process.env.ANTHROPIC_MODEL_DRAFT ?? "claude-haiku-5-5",
  extract: process.env.ANTHROPIC_MODEL_EXTRACT ?? "claude-haiku-5-5",
} as const;

export type PersonaMeta = {
  id: PersonaId;
  name: string;
  role: string;
  initials: string;
  home: string;
  /** One line: what they do in Docket (persona switcher). */
  does: string;
};

export const PERSONAS: Record<PersonaId, PersonaMeta> = {
  procurement: { id: "procurement", name: "Priya", role: "Procurement Lead", initials: "PR", home: "/inbox", does: "Decides risky renewals and drafts notices" },
  owner: { id: "owner", name: "Rahul", role: "Budget Owner", initials: "RA", home: "/requests", does: "Answers 2 questions per renewal and chooses" },
  legal: { id: "legal", name: "Meera", role: "Legal Counsel", initials: "ME", home: "/legal", does: "Approves notices before a human sends them" },
  finance: { id: "finance", name: "Akshat", role: "Finance / AP", initials: "AK", home: "/finance", does: "Checks invoices against the contract" },
};

export const DEFAULT_PERSONA: PersonaId = "procurement";
export const PERSONA_ORDER: PersonaId[] = ["procurement", "owner", "legal", "finance"];
