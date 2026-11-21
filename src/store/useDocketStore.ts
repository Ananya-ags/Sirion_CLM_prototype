"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_PERSONA, demoNowISO } from "@/lib/config";
import {
  canTransition,
  type Actor,
  type AuditEntry,
  type Draft,
  type FinanceConfirmation,
  type FinanceDismissal,
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
};

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
            ...fresh.map((r) => ({ id: auditId(), ts, requestId: r.id, actor, action: `Raised (${r.state})`, reason: r.lane_reason ?? reason })),
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

      resetDemo: () => set(initialData()),
    }),
    {
      name: "docket-demo-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ persona, requests, audit, financeConfirmations, financeDismissals, drafts }) => ({ persona, requests, audit, financeConfirmations, financeDismissals, drafts }),
      // Rehydrated on the client by <StoreHydrator /> to avoid SSR mismatches.
      skipHydration: true,
    },
  ),
);
