"use client";

import { useEffect } from "react";
import type { Request } from "@/lib/types";
import { useDocketStore } from "@/store/useDocketStore";

/**
 * Loads persisted demo state from localStorage after the first client render, then seeds the
 * requests Docket raised itself whenever the store is empty (first visit or after "Reset demo").
 */
export function StoreHydrator({ initialRequests }: { initialRequests: Request[] }) {
  useEffect(() => {
    const seedIfEmpty = () => {
      const s = useDocketStore.getState();
      if (Object.keys(s.requests).length === 0) s.seedRequests(initialRequests, "Rules");
    };
    let unsub = () => {};
    void Promise.resolve(useDocketStore.persist.rehydrate()).then(() => {
      seedIfEmpty();
      unsub = useDocketStore.subscribe((s, prev) => {
        if (Object.keys(s.requests).length === 0 && Object.keys(prev.requests).length > 0) seedIfEmpty();
      });
    });
    return () => unsub();
  }, [initialRequests]);
  return null;
}
