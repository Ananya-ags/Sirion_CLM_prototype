import type { Lane, RequestState } from "./types";

/**
 * Where a request Docket raises itself starts (Rules):
 * green → auto_logged (reversible); needs_review → human_review (Procurement confirms the unclear clause first);
 * amber / red → owner_pending (the budget owner decides first; only that decision moves it to Procurement).
 */
export function initialStateFor(lane: Lane | null): RequestState {
  if (lane === "green") return "auto_logged";
  if (lane === "needs_review") return "human_review";
  return "owner_pending";
}

/** States where Procurement can act on the decision card. */
export const PROCUREMENT_ACTIONABLE: RequestState[] = ["procurement_review"];
/** States where the budget owner is asked to decide. */
export const OWNER_OPEN: RequestState[] = ["raised", "owner_pending"];
