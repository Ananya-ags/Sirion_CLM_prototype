/**
 * Ledger checks (Rules): L1–L4.
 * Vendor matching here is a normalised-name fallback (first distinctive token);
 * the AI entity match replaces it later.
 */
import type { GlobalPolicy, LedgerRow } from "../types";

export function normName(s: string): string[] {
  const u = s
    .toUpperCase()
    .replace(/PVT\.?/g, "PRIVATE")
    .replace(/LTD\.?/g, "LIMITED");
  return u.replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean);
}

export function sameVendor(a: string, b: string): boolean {
  const x = normName(a)[0];
  return !!x && x === normName(b)[0];
}

/** Credit notes: invoice_no starts with "CN-" and amounts are negative. */
export const isCreditNote = (r: Pick<LedgerRow, "invoice_no">) => !!r.invoice_no && r.invoice_no.toUpperCase().startsWith("CN-");

export const rowsForVendor = (ledger: LedgerRow[], name: string) => ledger.filter((r) => sameVendor(r.erp_vendor_name, name));

export type LedgerSummary = {
  erp_vendor_names: string[];
  invoices: number;
  total_pre_tax_inr: number;
  total_inr: number;
  /** Distinct billed service periods (credit notes do not add a month). */
  service_periods: string[];
  credit_notes: { count: number; total_pre_tax_inr: number; service_periods: string[] };
};

export type L1 = { total_pre_tax_inr: number; annual_value_inr: number; overspend_inr: number; overspend_pct: number };
export type L2 = { contract_end: string; service_periods_after_expiry: string[]; monthly_pre_tax_inr: number; total_pre_tax_inr: number; total_incl_gst_inr: number; po_ref: string | null };
export type L3 = { from_service_period: string; months: number; contracted_monthly_inr: number; billed_monthly_inr: number; drift_pct: number; excess_pre_tax_inr: number };
export type L4 = { erp_vendor_name: string; recurring_months: number; monthly_pre_tax_inr: number; total_pre_tax_inr: number; po_ref: string };

export type LedgerResult = { summary: LedgerSummary; l1: L1 | null; l2: L2 | null; l3: L3 | null; l4: L4 | null };

export type LedgerInput = {
  rows: LedgerRow[];
  annualInr: number;
  /** Rounded monthly contract value (₹), as used for drift. */
  monthlyInr: number;
  renewalType: string | null;
  termEnd: string | null;
  hasTrackerRow: boolean;
  global: Pick<GlobalPolicy, "l1_overspend_tolerance_pct" | "l3_drift_tolerance_pct" | "l3_min_consecutive_months" | "l4_min_recurring_months">;
};

const mostCommon = (xs: number[]) => {
  const c = new Map<number, number>();
  xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function ledgerChecks(i: LedgerInput): LedgerResult {
  const all = [...i.rows].sort((a, b) => a.service_period.localeCompare(b.service_period));
  const credits = all.filter(isCreditNote);
  // Invoices only: L3 drift, L4 month counts and "most common monthly amount" ignore credit notes.
  const rows = all.filter((r) => !isCreditNote(r));
  const periods = [...new Set(rows.map((r) => r.service_period))];
  // L1 / totals: credit notes net off.
  const total = sum(all.map((r) => r.amount_pre_tax_inr));
  const summary: LedgerSummary = {
    erp_vendor_names: [...new Set(all.map((r) => r.erp_vendor_name))],
    invoices: all.length,
    total_pre_tax_inr: total,
    total_inr: sum(all.map((r) => r.total_inr)),
    service_periods: periods,
    credit_notes: { count: credits.length, total_pre_tax_inr: sum(credits.map((r) => r.amount_pre_tax_inr)), service_periods: [...new Set(credits.map((r) => r.service_period))] },
  };
  const live = i.renewalType !== "none";

  // L1: spend above contract value (+ tolerance)
  let l1: L1 | null = null;
  if (live && total > i.annualInr * (1 + i.global.l1_overspend_tolerance_pct / 100)) {
    l1 = { total_pre_tax_inr: total, annual_value_inr: i.annualInr, overspend_inr: total - i.annualInr, overspend_pct: Math.round((total / i.annualInr - 1) * 1000) / 10 };
  }

  // L2: paid for service periods after a fixed term expired
  let l2: L2 | null = null;
  if (!live && i.termEnd) {
    const endMonth = i.termEnd.slice(0, 7);
    const after = rows.filter((r) => r.service_period > endMonth);
    const afterAll = all.filter((r) => r.service_period > endMonth); // totals net any credit notes
    if (after.length) {
      l2 = {
        contract_end: i.termEnd,
        service_periods_after_expiry: [...new Set(after.map((r) => r.service_period))],
        monthly_pre_tax_inr: mostCommon(after.map((r) => r.amount_pre_tax_inr)),
        total_pre_tax_inr: sum(afterAll.map((r) => r.amount_pre_tax_inr)),
        total_incl_gst_inr: sum(afterAll.map((r) => r.total_inr)),
        po_ref: after[0].po_ref,
      };
    }
  }

  // L3: billing drift above contract for N consecutive months (longest run)
  let l3: L3 | null = null;
  const limit = i.monthlyInr * (1 + i.global.l3_drift_tolerance_pct / 100);
  let best: LedgerRow[] = [];
  let run: LedgerRow[] = [];
  for (const r of rows) {
    run = r.amount_pre_tax_inr > limit ? [...run, r] : [];
    if (run.length > best.length) best = run;
  }
  if (best.length >= i.global.l3_min_consecutive_months) {
    const billed = mostCommon(best.map((r) => r.amount_pre_tax_inr));
    l3 = {
      from_service_period: best[0].service_period,
      months: best.length,
      contracted_monthly_inr: i.monthlyInr,
      billed_monthly_inr: billed,
      drift_pct: Math.round((billed / i.monthlyInr - 1) * 1000) / 10,
      excess_pre_tax_inr: sum(best.map((r) => r.amount_pre_tax_inr - i.monthlyInr)),
    };
  }

  // L4: recurring spend with no tracker row
  let l4: L4 | null = null;
  if (!i.hasTrackerRow && periods.length >= i.global.l4_min_recurring_months) {
    l4 = {
      erp_vendor_name: summary.erp_vendor_names[0],
      recurring_months: periods.length,
      monthly_pre_tax_inr: mostCommon(rows.map((r) => r.amount_pre_tax_inr)),
      total_pre_tax_inr: total,
      po_ref: rows.find((r) => r.po_ref)?.po_ref ?? "none",
    };
  }
  return { summary, l1, l2, l3, l4 };
}

/** Ledger-wide scan: ERP vendors with recurring spend and no tracker row (incl. vendors with no contract on file). */
export function untrackedRecurringVendors(ledger: LedgerRow[], trackerNames: string[], minMonths: number): string[] {
  const byVendor = new Map<string, Set<string>>();
  for (const r of ledger) {
    if (isCreditNote(r)) continue;
    if (!byVendor.has(r.erp_vendor_name)) byVendor.set(r.erp_vendor_name, new Set());
    byVendor.get(r.erp_vendor_name)!.add(r.service_period);
  }
  return [...byVendor.entries()]
    .filter(([name, ps]) => ps.size >= minMonths && !trackerNames.some((t) => sameVendor(t, name)))
    .map(([name]) => name);
}
