import type { PersonaId } from "./types";

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

/** Gemini model names. Override with env vars without code changes. Server-side only. */
export const MODELS = {
  precompute: process.env.GEMINI_MODEL_PRO ?? "gemini-2.5-pro",
  live: process.env.GEMINI_MODEL_FLASH ?? "gemini-2.5-flash",
} as const;

export type PersonaMeta = {
  id: PersonaId;
  name: string;
  role: string;
  initials: string;
  home: string;
};

export const PERSONAS: Record<PersonaId, PersonaMeta> = {
  procurement: { id: "procurement", name: "Priya", role: "Procurement Lead", initials: "PR", home: "/inbox" },
  owner: { id: "owner", name: "Rahul", role: "Budget Owner", initials: "RA", home: "/requests" },
  legal: { id: "legal", name: "Meera", role: "Legal Counsel", initials: "ME", home: "/legal" },
  finance: { id: "finance", name: "Akshat", role: "Finance / AP", initials: "AK", home: "/finance" },
};

export const DEFAULT_PERSONA: PersonaId = "procurement";
export const PERSONA_ORDER: PersonaId[] = ["procurement", "owner", "legal", "finance"];
