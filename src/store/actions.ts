"use client";

import { toast } from "sonner";
import { PROCUREMENT_ACTIONABLE } from "@/lib/requestFlow";
import type { Draft, DraftKind, Lane, OwnerChoice } from "@/lib/types";
import { useDocketStore } from "./useDocketStore";

const S = () => useDocketStore.getState();
const report = (r: { ok: boolean; error?: string }, success: string) => (r.ok ? toast.success(success) : toast.error(r.error ?? "Not allowed"));

/** Rahul: Renew / Exit / Send to Procurement. Amber + Renew closes with owner confirmation; everything else goes to Procurement. */
export function ownerDecide(requestId: string, lane: Lane | null, choice: OwnerChoice, answers: Record<string, string>) {
  const label = { renew: "Renew", exit: "Exit", procurement: "Send to Procurement" }[choice];
  const reason = `${label} · still needed: ${answers.needed ?? "—"} · scope: ${answers.scope ?? "—"}`;
  const steps: Parameters<ReturnType<typeof S>["transitionPath"]>[1] = [
    ["owner_pending", "Rules", "Routed to budget owner"],
    ["owner_decided", "owner", reason],
  ];
  if (choice === "renew" && lane === "amber") steps.push(["renewed_logged", "Rules", "Amber lane: owner confirmation is enough; renewal logged"]);
  else steps.push(["procurement_review", "Rules", choice === "exit" ? "Exit requested: Procurement prepares the notice" : choice === "renew" ? `${lane === "red" ? "Red lane" : "Review lane"}: Procurement decides; auto-renewal not allowed` : "Owner asked Procurement to review"]);
  S().setOwnerDecision(requestId, { choice, reason, answers });
  report(S().transitionPath(requestId, steps), choice === "renew" && lane === "amber" ? "Renewal confirmed and logged" : "Sent to Procurement");
}

/** Procurement acts only after the budget owner has decided (state procurement_review). */
export function canProcurementAct(requestId: string) {
  const st = S().requests[requestId]?.state;
  return !!st && PROCUREMENT_ACTIONABLE.includes(st);
}

/** Priya confirms the unclear clause (human review); the request then goes to the budget owner. */
export function confirmReview(requestId: string, note: string) {
  report(S().transitionPath(requestId, [["owner_pending", "procurement", note || "Unclear clause confirmed by Procurement; routed to budget owner"]]), "Confirmed · sent to the budget owner");
}

export function approveRenewal(requestId: string) {
  report(S().transitionPath(requestId, [["renewed_logged", "procurement", "Renewal approved within existing terms"]]), "Renewal approved and logged");
}

export function handOffRenegotiation(requestId: string) {
  report(S().transitionPath(requestId, [["handoff_renegotiation", "procurement", "Out of scope: handled by Procurement (renegotiation)"]]), "Handed off to Procurement for renegotiation");
}

export async function draftNotice(requestId: string, kind: DraftKind): Promise<Draft | null> {
  if (!canProcurementAct(requestId)) {
    toast.error("Waiting on the budget owner's decision");
    return null;
  }
  const res = await fetch("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, kind }) }).catch(() => null);
  if (!res?.ok) {
    toast.error((await res?.json().catch(() => null))?.error ?? "Drafting failed");
    return null;
  }
  const draft = (await res.json()) as Draft;
  S().saveDraft(draft);
  const r = S().transitionPath(requestId, [["legal_pending", "procurement", `${kind === "exit_notice" ? "Exit notice" : "Cap-enforcement letter"} sent to Legal for approval`]]);
  if (r.ok && draft.source !== "live" && draft.guardrails.note) toast.info("Template draft (cached) · sent to Legal", { description: draft.guardrails.note });
  else report(r, draft.source === "live" ? "Draft ready · sent to Legal" : "Template draft (cached) · sent to Legal");
  return draft;
}

export function legalApprove(requestId: string) {
  const d = S().drafts[requestId];
  const method = d?.locked.find((l) => l.key === "notice_method")?.value ?? "the contractual method";
  report(
    S().transitionPath(requestId, [
      ["sent", "legal", `Approved and marked sent by ${method} (sent by a human, outside Docket)`],
      ["closed", "Rules", "Closed: notice sent before act-by"],
    ]),
    "Approved, marked sent, request closed",
  );
}

export function legalSendBack(requestId: string, reason: string) {
  report(S().transitionPath(requestId, [["procurement_review", "legal", reason || "Sent back to Procurement"]]), "Sent back to Procurement");
}
