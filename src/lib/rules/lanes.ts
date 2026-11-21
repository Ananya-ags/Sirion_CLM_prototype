/** Lane decision (Rules, never the LLM). Mirrors CLAUDE.md "Lanes". */
import type { FlagCode, GlobalPolicy, Lane } from "../types";

export type LaneInput = {
  flags: FlagCode[];
  annualInr: number;
  greenMaxInr: number;
  daysToActBy: number | null;
  global: Pick<GlobalPolicy, "red_days_to_act_by" | "minor_flags">;
};

/**
 * needs_review: X1 (unclear / low-confidence key field).
 * red: any material flag (F2, F3, F4, F6, L1–L4), or ≤ red_days_to_act_by days to act-by.
 *      F6 is only "above threshold" when annual > green max; below it, F6 is still not a minor
 *      flag, so it cannot be amber or green either (same as the data pack's reference engine).
 * amber: minor flags only (policy.global.minor_flags: F5, F7, X2, T1), or no flags but above the green limit.
 * green: no flags besides F1 and annual ≤ green max.
 */
export function decideLane(i: LaneInput): { lane: Lane; reason: string } {
  if (i.flags.includes("X1")) return { lane: "needs_review", reason: "Needs review: a key field is unclear or low-confidence (X1)." };

  const other = i.flags.filter((f) => f !== "F1");
  const material = other.filter((f) => !i.global.minor_flags.includes(f));
  const urgent = i.daysToActBy != null && i.daysToActBy <= i.global.red_days_to_act_by;
  if (material.length || urgent) {
    const why = [...material, ...(urgent ? [`act-by in ${i.daysToActBy} days`] : [])];
    return { lane: "red", reason: `Red: ${why.join(", ")}. Procurement decides; auto-renewal not allowed.` };
  }
  if (other.length) return { lane: "amber", reason: `Amber: minor flags only (${other.join(", ")}). Owner confirms.` };
  if (i.annualInr > i.greenMaxInr) return { lane: "amber", reason: "Amber: no flags, but annual value is above the green-lane limit." };
  return { lane: "green", reason: "Green: no material flags, within the green-lane limit, all key fields clear. Auto-logged (reversible)." };
}
