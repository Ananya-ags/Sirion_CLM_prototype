"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_PERSONA, demoNowISO } from "@/lib/config";
import {
  canTransition,
  type Actor,
  type AuditEntry,
  type FinanceConfirmation,
  type PersonaId,
  type Request,
  type RequestState,
} from "@/lib/types";

type Data = {
  persona: PersonaId;
  requests: Record<string, Request>;
  audit: AuditEntry[];
  financeConfirmations: Record<string, FinanceConfirmation>;
};

type Actions = {
  setPersona: (persona: PersonaId) => void;
  /** Adds requests that are not already in the store (used to seed from data). */
  seedRequests: (requests: Request[], actor?: Actor, reason?: string) => void;
  transition: (requestId: string, toState: RequestState, actor: Actor, reason: string) => { ok: true } | { ok: false; error: string };
  confirmFinance: (c: Omit<FinanceConfirmation, "ts">) => void;
  resetDemo: () => void;
};

export type DocketStore = Data & Actions;

const initialData = (): Data => ({
  persona: DEFAULT_PERSONA,
  requests: {},
  audit: [],
  financeConfirmations: {},
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
      name: "docket-demo-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ persona, requests, audit, financeConfirmations }) => ({ persona, requests, audit, financeConfirmations }),
      // Rehydrated on the client by <StoreHydrator /> to avoid SSR mismatches.
      skipHydration: true,
    },
  ),
);
