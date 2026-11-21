/**
 * Evidence-based review routing (pure). Self-reported confidence is a displayed signal only: the Step 3 evals showed it
 * did not predict errors. A field goes to human review when there is EVIDENCE of a problem:
 *   quote not verified · "unclear" · read from OCR · a key field not stated (where it applies).
 * A human-confirmed / corrected field (source "human") never routes again.
 */
import type { Field } from "../types";

export const REVIEW_KEY_FIELDS = ["renewal_type", "initial_term_end", "notice_days", "notice_day_type", "uplift.type"] as const;
export type ReviewReason = "quote not verified" | "unclear" | "OCR" | "key field not stated";

type Terms = { renewal_type: Field<unknown> } & Record<string, unknown>;

/** Notice fields don't apply to a contract that does not renew (or renews only by fresh agreement). */
export function notApplicable(key: string, terms: Terms): boolean {
  const rt = terms.renewal_type?.value;
  return (rt === "none" || rt === "manual") && (key === "notice_days" || key === "notice_day_type" || key === "renewal_term_months");
}

export function reviewReasons(key: string, f: Field<unknown>, terms: Terms, keyFields: readonly string[] = REVIEW_KEY_FIELDS): ReviewReason[] {
  if (f.source === "human") return [];
  const r: ReviewReason[] = [];
  if (f.verified === false) r.push("quote not verified");
  if (f.value === "unclear") r.push("unclear");
  if (f.ocr) r.push("OCR");
  if (f.value === null && keyFields.includes(key) && !notApplicable(key, terms)) r.push("key field not stated");
  return r;
}
