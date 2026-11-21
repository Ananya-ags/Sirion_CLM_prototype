/** Rate vs benchmark (Rules). */
import { PLANNED_HOURS_PER_RESOURCE_MONTH } from "../config";
import type { Benchmark, CategoryPolicy, RateLine } from "../types";

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type BenchmarkResult = {
  role: string;
  benchmarkRole: string;
  rate: number;
  median: number | null;
  comparables: number;
  gapPct: number | null;
  annualGapInr: number | null;
  flagged: boolean;
  reason: string;
};

export function benchmarkGap(
  line: RateLine,
  benchmarks: Benchmark[],
  policy: Pick<CategoryPolicy, "min_comparables" | "benchmark_gap_pct">,
  hoursPerMonth = PLANNED_HOURS_PER_RESOURCE_MONTH,
): BenchmarkResult {
  const rates = benchmarks.filter((b) => b.role === line.benchmark_role).map((b) => b.rate_inr_per_hr);
  const base = { role: line.role_in_contract, benchmarkRole: line.benchmark_role, rate: line.rate_inr_per_hr, comparables: rates.length };
  if (rates.length < policy.min_comparables) {
    return { ...base, median: rates.length ? median(rates) : null, gapPct: null, annualGapInr: null, flagged: false, reason: `only ${rates.length} comparables (< min ${policy.min_comparables})` };
  }
  const med = median(rates);
  const gapPct = Math.round((line.rate_inr_per_hr / med - 1) * 10000) / 100;
  const annualGapInr = (line.rate_inr_per_hr - med) * line.count * hoursPerMonth * 12;
  const flagged = gapPct >= policy.benchmark_gap_pct;
  return {
    ...base,
    median: med,
    gapPct,
    annualGapInr,
    flagged,
    reason: flagged ? `+${gapPct}% vs median ₹${med}/hr (≥ ${policy.benchmark_gap_pct}%)` : `${gapPct}% vs median (below ${policy.benchmark_gap_pct}%)`,
  };
}
