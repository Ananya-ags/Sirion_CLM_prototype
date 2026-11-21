"use client";

import { useEffect } from "react";
import { useDocketStore } from "@/store/useDocketStore";

/** Loads persisted demo state from localStorage after the first client render. */
export function StoreHydrator() {
  useEffect(() => {
    void useDocketStore.persist.rehydrate();
  }, []);
  return null;
}
