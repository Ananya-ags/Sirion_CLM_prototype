/**
 * v3 Rules: S1 SLA_CREDIT_UNCLAIMED and U1 LOW_UTILISATION. Pure and deterministic.
 * Source-agnostic: SLA terms and licensed quantities are passed in (AI extraction from the cache, gold seed as fallback,
 * AI extraction from the executed contract / order form later).
 */
import type { Citation, CreditBand, LicensedLine, SlaPerformanceRow, SlaTerms, UsageRow } from "../types";

/* ------------------------------------------------------------------ */
/* S1: SLA credits                                                     */
/* ------------------------------------------------------------------ */

export type SlaBreach = {
  month: string;
  metric: string;
  target: number;
  actual: number;
  credit_pct: number;
  credit_due_original: number;
  credit_due_inr: number;
  currency: string;
  claimed: boolean;
};

export type SlaMonth = { month: string; metric: string; target: number; actual: number; met: boolean };

export type SlaResult = {
  metric: string;
  target: number;
  monthsReported: number;
  monthsMet: number;
  months: SlaMonth[];
  /** Breaches that have a credit band (the contract has a % credit table). */
  breaches: SlaBreach[];
  /** True when the contract has no % credit table or no fee basis, so credits can't be computed. */
  noCreditTable: boolean;
  creditsDueInr: number;
  creditsClaimedInr: number;
  unclaimedInr: number;
  unclaimedMonths: string[];
  citation?: Citation;
};

export type SlaInput = {
  terms: SlaTerms;
  /** sla_performance rows for this vendor only. */
  rows: SlaPerformanceRow[];
  /** Service periods with a CN- credit note in the ledger for this vendor. */
  creditNotePeriods: ReadonlySet<string>;
  usdInr: number;
};

const bandFor = (bands: CreditBand[], actual: number) => bands.find((b) => b.from_incl <= actual && actual < b.to_excl) ?? null;
const metricMatches = (rowMetric: string, termMetric: string) => rowMetric === termMetric || rowMetric.startsWith(`${termMetric}:`);

export function slaCredits(i: SlaInput): SlaResult {
  const t = i.terms;
  const rows = i.rows.filter((r) => metricMatches(r.metric, t.metric)).sort((a, b) => a.month.localeCompare(b.month) || a.metric.localeCompare(b.metric));
  const bands = Array.isArray(t.credit_rule) ? t.credit_rule : null;
  const noCreditTable = !bands || t.fee_basis_monthly == null;
  const rate = t.currency === "USD" ? i.usdInr : 1;
  const months: SlaMonth[] = rows.map((r) => ({ month: r.month, metric: r.metric, target: t.target, actual: r.actual, met: r.actual >= t.target }));
  const breaches: SlaBreach[] = [];
  if (!noCreditTable) {
    for (const m of months) {
      if (m.met) continue;
      const band = bandFor(bands!, m.actual);
      if (!band) continue;
      const original = (t.fee_basis_monthly! * band.credit_pct) / 100;
      breaches.push({
        month: m.month,
        metric: m.metric,
        target: m.target,
        actual: m.actual,
        credit_pct: band.credit_pct,
        credit_due_original: Math.round(original * 100) / 100,
        credit_due_inr: Math.round(t.fee_basis_monthly! * rate * band.credit_pct / 100),
        currency: t.currency,
        claimed: i.creditNotePeriods.has(m.month),
      });
    }
  }
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const due = sum(breaches.map((b) => b.credit_due_inr));
  const claimed = sum(breaches.filter((b) => b.claimed).map((b) => b.credit_due_inr));
  return {
    metric: t.metric,
    target: t.target,
    monthsReported: new Set(rows.map((r) => r.month)).size,
    monthsMet: new Set(months.map((m) => m.month)).size - new Set(months.filter((m) => !m.met).map((m) => m.month)).size,
    months,
    breaches,
    noCreditTable,
    creditsDueInr: due,
    creditsClaimedInr: claimed,
    unclaimedInr: due - claimed,
    unclaimedMonths: [...new Set(breaches.filter((b) => !b.claimed).map((b) => b.month))],
    citation: t.citation,
  };
}

/** Distinct breach months in the last 12 reported months (claimed or not). */
export function breachMonthsIn12(r: SlaResult): number {
  const months = [...new Set(r.months.map((m) => m.month))].sort().slice(-12);
  return new Set(r.months.filter((m) => !m.met && months.includes(m.month)).map((m) => m.month)).size;
}

/* ------------------------------------------------------------------ */
/* U1: utilisation                                                     */
/* ------------------------------------------------------------------ */

export type UtilisationLine = {
  metric: string;
  licensed_units: number;
  months: { month: string; active: number; licensed: number; pct: number }[];
  latest_pct: number;
  latest_active: number;
  /** Consecutive latest months below the threshold. */
  months_below: number;
  avg_active_last_n: number;
  n: number;
  unused_units: number;
  unused_value_inr: number;
  flagged: boolean;
};

export type UtilisationResult = {
  lines: UtilisationLine[];
  totalLicensedUnits: number;
  /** annual value ÷ total licensed units (implied; the order form doesn't price lines separately). */
  impliedAnnualCostPerUnitInr: number;
  unusedValueInr: number;
  flagPct: number;
};

export type UtilisationInput = {
  /** Licensed units per line from the order form. */
  licensed: LicensedLine[];
  /** usage rows for this vendor only. */
  rows: UsageRow[];
  annualInr: number;
  flagPct: number;
  minMonths: number;
};

const r1 = (x: number) => Math.round(x * 10) / 10;

export function utilisation(i: UtilisationInput): UtilisationResult | null {
  if (!i.licensed.length) return null;
  const total = i.licensed.reduce((a, l) => a + l.licensed_units, 0);
  const perUnit = total ? i.annualInr / total : 0;
  const lines: UtilisationLine[] = [];
  for (const l of i.licensed) {
    const rows = i.rows.filter((r) => r.metric === l.metric).sort((a, b) => a.month.localeCompare(b.month));
    if (!rows.length) continue;
    const months = rows.map((r) => ({ month: r.month, active: r.active_units, licensed: l.licensed_units, pct: (r.active_units / l.licensed_units) * 100 }));
    let below = 0;
    for (let k = months.length - 1; k >= 0 && months[k].pct < i.flagPct; k--) below++;
    const n = Math.min(i.minMonths, months.length);
    const avgActive = months.slice(-n).reduce((a, m) => a + m.active, 0) / n;
    const flagged = below >= i.minMonths;
    const unused = l.licensed_units - avgActive;
    lines.push({
      metric: l.metric,
      licensed_units: l.licensed_units,
      months: months.map((m) => ({ ...m, pct: r1(m.pct) })),
      latest_pct: r1(months.at(-1)!.pct),
      latest_active: months.at(-1)!.active,
      months_below: below,
      avg_active_last_n: r1(avgActive),
      n,
      unused_units: r1(unused),
      unused_value_inr: flagged ? Math.round(unused * perUnit) : 0,
      flagged,
    });
  }
  if (!lines.length) return null;
  return { lines, totalLicensedUnits: total, impliedAnnualCostPerUnitInr: Math.round(perUnit), unusedValueInr: lines.reduce((a, l) => a + l.unused_value_inr, 0), flagPct: i.flagPct };
}

/**
 * Contracted monthly fee for SLA credits (Rules, never the LLM): annual value ÷ 12 in the contract currency,
 * only when the contract applies the credit % to the monthly fees. Per-circuit / per-unit bases stay null.
 */
export function withFeeBasis(t: SlaTerms, annualOriginal: number | null): SlaTerms {
  if (t.fee_basis_monthly != null || t.credit_basis !== "monthly_fees" || annualOriginal == null) return t;
  return { ...t, fee_basis_monthly: Math.round(annualOriginal / 12) };
}
