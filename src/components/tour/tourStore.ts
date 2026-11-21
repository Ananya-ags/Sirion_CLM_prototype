"use client";

import { create } from "zustand";

/** Guided-tour UI state (not persisted; "seen" lives in localStorage under SEEN_KEY). */
export const SEEN_KEY = "docket-tour-seen";

type TourState = {
  welcome: boolean;
  step: number | null;
  busy: boolean;
  openWelcome: () => void;
  closeWelcome: () => void;
  setStep: (s: number | null) => void;
  setBusy: (b: boolean) => void;
};

export const useTour = create<TourState>()((set) => ({
  welcome: false,
  step: null,
  busy: false,
  openWelcome: () => set({ welcome: true }),
  closeWelcome: () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private mode */
    }
    set({ welcome: false });
  },
  setStep: (step) => set({ step }),
  setBusy: (busy) => set({ busy }),
}));
