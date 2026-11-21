"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupplierView } from "@/lib/seed";
import { useDocketStore } from "@/store/useDocketStore";

/** Re-evaluated views keyed by supplier + overrides (module-level so navigation doesn't refetch). */
const cache = new Map<string, SupplierView>();
const inflight = new Map<string, Promise<SupplierView | null>>();
const keyOf = (id: string, o: unknown) => `${id}|${JSON.stringify(o)}`;

function reevaluate(supplierId: string, overrides: { key: string; action: string; value?: string }[]): Promise<SupplierView | null> {
  const k = keyOf(supplierId, overrides);
  if (cache.has(k)) return Promise.resolve(cache.get(k)!);
  if (!inflight.has(k)) {
    inflight.set(
      k,
      fetch("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplierId, overrides }) })
        .then((r) => (r.ok ? (r.json() as Promise<SupplierView>) : null))
        .catch(() => null)
        .then((v) => {
          if (v) cache.set(k, v);
          inflight.delete(k);
          return v;
        }),
    );
  }
  return inflight.get(k)!;
}

/**
 * Server views, with suppliers that have human overrides re-run through the rules engine (/api/evaluate).
 * Keeps the original review list (so confirmed items still show as "done") and syncs the request
 * (lane, flags, dates, and leaving human review) through the store, which audits it.
 */
export function useLiveViews(views: SupplierView[]): SupplierView[] {
  const overrides = useDocketStore((s) => s.overrides);
  const applyReevaluation = useDocketStore((s) => s.applyReevaluation);
  const [, bump] = useState(0);

  // A stable string key: callers may pass a fresh array every render (must not retrigger the effect).
  const wantedKey = JSON.stringify(
    views.filter((v) => overrides[v.supplierId]?.length).map((v) => ({ id: v.supplierId, o: overrides[v.supplierId].map(({ key, action, value }) => ({ key, action, value })) })),
  );
  const wanted = useMemo(() => JSON.parse(wantedKey) as { id: string; o: { key: string; action: string; value?: string }[] }[], [wantedKey]);

  useEffect(() => {
    let alive = true;
    for (const { id, o } of wanted) {
      const had = cache.has(keyOf(id, o));
      void reevaluate(id, o).then((live) => {
        if (!alive || !live) return;
        applyReevaluation(`REQ-${id}`, { lane: live.lane, laneReason: live.laneReason, flags: live.flags, actBy: live.actBy?.actBy ?? null, internalBy: live.actBy?.decisionTarget ?? null, annualInr: live.money.annualInr });
        if (!had) bump((n) => n + 1); // re-render once when a new result lands (never on cache hits → no loop)
      });
    }
    return () => {
      alive = false;
    };
  }, [wanted, applyReevaluation]);

  return views.map((v) => {
    const w = wanted.find((x) => x.id === v.supplierId);
    const live = w ? cache.get(keyOf(w.id, w.o)) : undefined;
    return live ? { ...live, reviewFields: v.reviewFields } : v;
  });
}
