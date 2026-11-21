import { FLAG_CATALOG } from "./flags-catalog";
import type { FlagCode, FlagSeverity } from "./types";

export type FlagMeta = {
  code: FlagCode;
  key: string;
  label: string;
  description: string;
  /** Default severity; the rules engine may escalate (e.g. F2/F6 above threshold). */
  severity: FlagSeverity;
};

/** Derived from the single catalogue in flags-catalog.ts. */
export const FLAGS = Object.fromEntries(
  FLAG_CATALOG.map((e) => [e.code, { code: e.code, key: e.key, label: e.label, description: e.describe(), severity: e.severity }]),
) as Record<FlagCode, FlagMeta>;
