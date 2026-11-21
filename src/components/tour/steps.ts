"use client";

import { draftNotice, legalApprove, ownerDecide } from "@/store/actions";
import { useDocketStore } from "@/store/useDocketStore";

export type TourStep = {
  /**
   * Where the step happens. The persona follows the route (src/lib/nav.ts); the shared contract page
   * carries ?as=<persona>, so the tour has no persona-switching code of its own.
   */
  path: string;
  /** data-tour attribute of the element to spotlight. */
  target: string;
  title: string;
  body: string;
  /** Callout position; default: below / above the target. */
  placement?: "left";
  /** Label for the Next button when it performs the step's action. */
  nextLabel?: string;
  /** Runs on the step's page until it returns true (e.g. open the citation sheet once the term card exists). */
  onEnter?: () => boolean;
  /** Runs when Next is pressed, before moving on (skipped if the demo state already moved on). */
  onNext?: () => Promise<unknown> | unknown;
};

const S = () => useDocketStore.getState();
const stateOf = (id: string) => S().requests[id]?.state;
const click = (sel: string) => {
  const el = document.querySelector(sel) as HTMLElement | null;
  el?.click();
  return !!el;
};

export const TOUR: TourStep[] = [
  {
    path: "/inbox",
    target: "snapshot",
    title: "Renewal snapshot",
    body: "Docket raised every renewal itself. Priya sees money at stake and what needs her; cards filter the queue.",
  },
  {
    path: "/inbox",
    target: "alerts",
    title: "Alerts the tracker missed",
    body: "Tracker conflicts and a silent renewal found only in the ledger. Rules compute these; no hard-coded lists.",
  },
  {
    path: "/contracts/SUP-09?as=procurement",
    target: "contract-header",
    title: "TalkWave: the silent renewal",
    body: "₹13.2L a year, auto-renews, not in the tracker. The signed contract sat in a shared mailbox.",
  },
  {
    path: "/contracts/SUP-09?as=procurement",
    target: "citation-sheet",
    placement: "left",
    title: "Every value cites the contract",
    body: "A verbatim quote, checked in code. Annexure 3 hides “classify as non-renewing”: ignored, still auto-renew, 24 months.",
    onEnter: () => click('[data-tour="term-renewal_type"]'),
  },
  {
    path: "/requests",
    target: "seats-SUP-01",
    title: "Rahul, the budget owner",
    body: "Plain language, no codes. For Nimbus he sees seat use (316 of 450). Docket informs; it doesn't recommend cuts.",
  },
  {
    path: "/requests",
    target: "req-SUP-09",
    title: "Rahul chooses Exit for TalkWave",
    body: "Two questions, three buttons. His decision routes the request to Procurement.",
    nextLabel: "Choose Exit for Rahul",
    onNext: () => stateOf("REQ-SUP-09") === "owner_pending" && ownerDecide("REQ-SUP-09", "red", "exit", { needed: "No", scope: "Same" }),
  },
  {
    path: "/contracts/SUP-09?as=procurement",
    target: "decision",
    title: "Priya acts on Rahul's decision",
    body: "One primary action: draft the exit notice. Claude writes wording only; dates, method and address are locked by Rules.",
    nextLabel: "Draft exit notice (live AI)",
    onNext: () => (stateOf("REQ-SUP-09") === "procurement_review" ? draftNotice("REQ-SUP-09", "exit_notice") : undefined),
  },
  {
    path: "/contracts/SUP-09?as=procurement",
    target: "draft-summary",
    title: "Guardrails on every draft",
    body: "Negotiation-boundary and number checks. If either fails, Docket retries once, then uses the template (labelled).",
  },
  {
    path: "/legal",
    target: "legal-draft",
    placement: "left",
    title: "Meera approves; a human sends",
    body: "Locked fields as chips, guardrail badges, one primary action. Docket never sends anything itself.",
    nextLabel: "Approve & mark sent",
    onNext: () => stateOf("REQ-SUP-09") === "legal_pending" && legalApprove("REQ-SUP-09"),
  },
  {
    path: "/finance",
    target: "alert-SUP-10-L2",
    title: "Akshat: paid after expiry",
    body: "LearnLeap's contract ended in June; invoices kept coming. Confirming attaches this to Priya's evidence.",
    nextLabel: "Confirm",
    onNext: () =>
      !S().financeConfirmations["SUP-10-L2"] &&
      S().confirmFinance({ alertId: "SUP-10-L2", requestId: "REQ-SUP-10", flagCode: "L2", confirmedBy: "finance", note: "Paid after expiry (confirmed in tour)" }),
  },
  {
    path: "/finance",
    target: "alert-SUP-01-S1",
    title: "An SLA credit nobody claimed",
    body: "Nimbus missed uptime in Aug and Sep: ₹77,500 due on the contracted fee, no credit note in the ledger.",
    nextLabel: "Confirm",
    onNext: () =>
      !S().financeConfirmations["SUP-01-S1"] &&
      S().confirmFinance({ alertId: "SUP-01-S1", requestId: "REQ-SUP-01", flagCode: "S1", confirmedBy: "finance", note: "SLA credit unclaimed (confirmed in tour)" }),
  },
  {
    path: "/evals",
    target: "evals-headline",
    title: "How well does it work?",
    body: "Blind held-out score vs after design fixes, labelled honestly. Every card says what it protects against.",
  },
  {
    path: "/brief",
    target: "brief-howto",
    title: "Prototype Guide & Case Brief",
    body: "The case write-up, the AI / Rules / Human split and the eval numbers. Explore freely; Tour reopens this.",
    nextLabel: "Finish",
  },
];
