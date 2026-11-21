"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_PERSONA, demoNowISO } from "@/lib/config";
import { initialStateFor } from "@/lib/requestFlow";
import {
  canTransition,
  type Actor,
  type AuditEntry,
  type Draft,
  type FinanceConfirmation,
  type FinanceDismissal,
  type Flag,
  type HumanOverride,
  type Lane,
  type PersonaId,
  type Request,
  type RequestState,
} from "@/lib/types";

type Data = {
  persona: PersonaId;
  requests: Record<string, Request>;
  audit: AuditEntry[];
  financeConfirmations: Record<string, FinanceConfirmation>;
  financeDismissals: Record<string, FinanceDismissal>;
  drafts: Record<string, Draft>;
  /** Human review of AI output: field confirmations/corrections and unmatched-document decisions. */
  reviews: Record<string, ReviewDecision>;
  /** Human overrides per supplier (source "human", confidence 1.0), fed back into the rules engine. */
  overrides: Record<string, (HumanOverride & { by: PersonaId; ts: string })[]>;
};

/** Result of re-running the rules engine after a human override. */
export type Reevaluation = { lane: Lane | null; laneReason: string; flags: Flag[]; actBy: string | null; internalBy: string | null; annualInr: number };

export type ReviewDecision = { itemId: string; kind: "field" | "document"; action: "confirmed" | "corrected"; value?: string; by: PersonaId; ts: string };

type Step = [toState: RequestState, actor: Actor, reason: string];

type Actions = {
  setPersona: (persona: PersonaId) => void;
  /** Adds requests that are not already in the store (used to seed from data). */
  seedRequests: (requests: Request[], actor?: Actor, reason?: string) => void;
  transition: (requestId: string, toState: RequestState, actor: Actor, reason: string) => { ok: true } | { ok: false; error: string };
  /** Runs several transitions in order; stops at the first one that is not allowed. */
  transitionPath: (requestId: string, steps: Step[]) => { ok: true } | { ok: false; error: string };
  setOwnerDecision: (requestId: string, d: NonNullable<Request["owner_decision"]>) => void;
  saveDraft: (d: Draft) => void;
  confirmFinance: (c: Omit<FinanceConfirmation, "ts">) => void;
  dismissFinance: (d: Omit<FinanceDismissal, "ts">) => void;
  /** Applies a rules re-run to the request: lane/flags/dates; a review-lane request leaves human review once clear. */
  applyReevaluation: (requestId: string, r: Reevaluation) => void;
  /** Records a human decision on an AI field or unmatched document (always audited). */
  recordReview: (d: Omit<ReviewDecision, "ts">, requestId: string | null, label: string) => void;
  resetDemo: () => void;
};

export type DocketStore = Data & Actions;

const initialData = (): Data => ({
  persona: DEFAULT_PERSONA,
  requests: {},
  audit: [],
  financeConfirmations: {},
  financeDismissals: {},
  drafts: {},
  reviews: {},
  overrides: {},
});

let seq = 0;
const auditId = () => `AUD-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useDocketStore = create<DocketStore>()(
  persist(
    (set, get) => ({
      ...initialData(),

      setPersona: (persona) => set({ persona }),

      seedRequests: (requests, actor = "AI", reason = "Renewal window detected") => {
        const existing = get().requests;
        const fresh = requests.filter((r) => !existing[r.id]);
        if (!fresh.length) return;
        const ts = demoNowISO();
        set((s) => ({
          requests: { ...s.requests, ...Object.fromEntries(fresh.map((r) => [r.id, r])) },
          audit: [
            ...s.audit,
            ...fresh.map((r) => ({ id: auditId(), ts, requestId: r.id, actor, action: r.state === "owner_pending" ? "Raised → budget owner" : r.state === "human_review" ? "Raised → human review" : r.state === "auto_logged" ? "Raised → auto-logged" : `Raised (${r.state})`, reason: r.lane_reason ?? reason })),
          ],
        }));
      },

      transition: (requestId, toState, actor, reason) => {
        const req = get().requests[requestId];
        if (!req) return { ok: false, error: `Unknown request ${requestId}` };
        if (!canTransition(req.state, toState)) {
          return { ok: false, error: `Not allowed: ${req.state} → ${toState}` };
        }
        const ts = demoNowISO();
        set((s) => ({
          requests: { ...s.requests, [requestId]: { ...req, state: toState, updated_at: ts } },
          audit: [...s.audit, { id: auditId(), ts, requestId, actor, action: `${req.state} → ${toState}`, reason }],
        }));
        return { ok: true };
      },

      transitionPath: (requestId, steps) => {
        for (const [to, actor, reason] of steps) {
          if (get().requests[requestId]?.state === to) continue;
          const r = get().transition(requestId, to, actor, reason);
          if (!r.ok) return r;
        }
        return { ok: true };
      },

      setOwnerDecision: (requestId, d) =>
        set((s) => (s.requests[requestId] ? { requests: { ...s.requests, [requestId]: { ...s.requests[requestId], owner_decision: d } } } : s)),

      saveDraft: (d) =>
        set((s) => ({
          drafts: { ...s.drafts, [d.requestId]: d },
          audit: [
            ...s.audit,
            {
              id: auditId(),
              ts: demoNowISO(),
              requestId: d.requestId,
              actor: d.source === "live" ? "AI" : "Rules",
              action: `Drafted ${d.kind === "exit_notice" ? "exit notice" : "cap-enforcement letter"} (${d.source})`,
              reason: `Boundary ${d.guardrails.boundary.ok ? "✓" : "✗"} · Numbers ${d.guardrails.numbers.ok ? "✓" : "✗"}${d.guardrails.note ? ` · ${d.guardrails.note}` : ""}`,
            },
          ],
        })),

      dismissFinance: (d) =>
        set((s) => ({
          financeDismissals: { ...s.financeDismissals, [d.alertId]: { ...d, ts: demoNowISO() } },
          audit: [...s.audit, { id: auditId(), ts: demoNowISO(), requestId: d.requestId, actor: d.by, action: `Dismissed billing alert ${d.alertId}`, reason: d.reason }],
        })),

      confirmFinance: (c) => {
        const ts = demoNowISO();
        set((s) => ({
          financeConfirmations: { ...s.financeConfirmations, [c.alertId]: { ...c, ts } },
          audit: [
            ...s.audit,
            {
              id: auditId(),
              ts,
              requestId: c.requestId,
              actor: c.confirmedBy,
              action: `Confirmed ${c.flagCode} billing alert`,
              reason: c.note ?? "Attached as evidence to the Procurement card",
            },
          ],
        }));
      },

      applyReevaluation: (requestId, r) => {
        const req = get().requests[requestId];
        if (!req) return;
        const same = req.lane === r.lane && JSON.stringify(req.flags.map((f) => f.code)) === JSON.stringify(r.flags.map((f) => f.code)) && req.act_by === r.actBy;
        if (same) return;
        const ts = demoNowISO();
        set((s) => ({
          requests: { ...s.requests, [requestId]: { ...req, lane: r.lane, lane_reason: r.laneReason, flags: r.flags, act_by: r.actBy, internal_by: r.internalBy, annual_value_inr: r.annualInr, updated_at: ts } },
          audit: [
            ...s.audit,
            { id: auditId(), ts, requestId, actor: "Rules", action: `Re-evaluated after human review: ${req.lane ?? "—"} → ${r.lane ?? "—"}`, reason: r.laneReason },
          ],
        }));
        // Out of human review once no key field is unclear: route like a freshly raised request.
        if (req.state === "human_review" && r.lane && r.lane !== "needs_review") {
          get().transition(requestId, initialStateFor(r.lane), "Rules", `Key fields confirmed by a human; ${r.lane} lane`);
        }
      },

      recordReview: (d, requestId, label) => {
        const ts = demoNowISO();
        const m = d.kind === "field" ? d.itemId.match(/^field:(SUP-\d{2}):(.+)$/) : null;
        set((s) => ({
          reviews: { ...s.reviews, [d.itemId]: { ...d, ts } },
          overrides: m
            ? { ...s.overrides, [m[1]]: [...(s.overrides[m[1]] ?? []).filter((o) => o.key !== m[2]), { key: m[2], action: d.action, ...(d.value !== undefined ? { value: d.value } : {}), by: d.by, ts }] }
            : s.overrides,
          audit: [
            ...s.audit,
            {
              id: auditId(),
              ts,
              requestId,
              actor: d.by,
              action: d.action === "confirmed" ? `Confirmed ${label}` : `Corrected ${label} → ${d.value}`,
              reason: d.kind === "field" ? "Human override (source: human, confidence 1.0); rules re-run" : "Human review of document grouping",
            },
          ],
        }));
      },

      resetDemo: () => set(initialData()),
    }),
    {
      name: "docket-demo-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ persona, requests, audit, financeConfirmations, financeDismissals, drafts, reviews, overrides }) => ({ persona, requests, audit, financeConfirmations, financeDismissals, drafts, reviews, overrides }),
      // Rehydrated on the client by <StoreHydrator /> to avoid SSR mismatches.
      skipHydration: true,
    },
  ),
);
