import { describe, expect, it } from "vitest";
import type { LedgerRow } from "../types";
import { actByInfo, addDays, computeActBy, daysBetween, isBusinessDay } from "./actBy";
import { benchmarkGap, median } from "./benchmark";
import { decideLane } from "./lanes";
import { ledgerChecks, normName, sameVendor, untrackedRecurringVendors } from "./ledger";
import { effectiveUplift, formatINR, formatINRShort, quoteVsCap, toInr } from "./money";

// Subset of holidays.json used in these edge cases.
const H = new Set(["2026-12-25", "2027-01-01", "2027-01-15", "2027-01-26", "2026-11-09", "2026-11-10"]);
const G = { red_days_to_act_by: 14, minor_flags: ["F5", "F7", "X2", "T1"] };

describe("act-by edge cases", () => {
  it.each([
    ["calendar: simple 90 days", "2027-03-31", 90, "calendar", "2026-12-31"],
    ["calendar: lands on leap day", "2028-03-01", 1, "calendar", "2028-02-29"],
    ["calendar: non-leap February", "2027-03-01", 1, "calendar", "2027-02-28"],
    ["calendar: zero notice = term end", "2027-01-10", 0, "calendar", "2027-01-10"],
    ["calendar: crosses year boundary", "2027-01-10", 20, "calendar", "2026-12-21"],
    ["calendar: lands on a holiday, no roll", "2027-01-25", 10, "calendar", "2027-01-15"],
    ["calendar: lands on a weekend, no roll", "2026-12-06", 1, "calendar", "2026-12-05"],
    ["business: Monday term end, 1 day → Friday", "2026-11-30", 1, "business", "2026-11-27"],
    ["business: skips Christmas", "2026-12-28", 1, "business", "2026-12-24"],
    ["business: Saturday term end → Friday", "2026-12-05", 1, "business", "2026-12-04"],
    ["business: term-end holiday is not counted", "2027-01-27", 1, "business", "2027-01-25"],
    ["business: skips back-to-back holidays", "2026-11-11", 1, "business", "2026-11-06"],
    ["business: 5 days across a weekend", "2026-12-07", 5, "business", "2026-11-30"],
  ] as const)("%s", (_n, end, days, type, expected) => {
    expect(computeActBy(end, days, type, H)).toBe(expected);
  });

  it("days left can be negative (act-by passed)", () => {
    expect(daysBetween("2026-11-25", "2026-11-20")).toBe(-5);
    expect(addDays("2026-11-25", 36)).toBe("2026-12-31");
  });

  it("decision target = act-by − buffer; passed flag", () => {
    const i = actByInfo({ renewalType: "auto", termEnd: "2027-01-31", noticeDays: 60, dayType: "calendar", holidays: H, bufferDays: 15, today: "2026-11-25" })!;
    expect(i).toMatchObject({ actBy: "2026-12-02", decisionTarget: "2026-11-17", decisionTargetPassed: true, daysToActBy: 7 });
  });

  it("no act-by unless auto-renewing with clear notice", () => {
    const base = { termEnd: "2027-01-31", noticeDays: 60, dayType: "calendar" as const, holidays: H, bufferDays: 15 };
    expect(actByInfo({ ...base, renewalType: "evergreen" })).toBeNull();
    expect(actByInfo({ ...base, renewalType: "unclear" })).toBeNull();
    expect(actByInfo({ ...base, renewalType: "auto", noticeDays: null })).toBeNull();
  });

  it("weekend and holiday detection", () => {
    expect(isBusinessDay("2026-11-28", H)).toBe(false); // Saturday
    expect(isBusinessDay("2026-12-25", H)).toBe(false);
    expect(isBusinessDay("2026-12-24", H)).toBe(true);
  });
});

describe("money", () => {
  it("uplift types", () => {
    expect(effectiveUplift("greater_of", 7, null, 5.2).pct).toBe(7);
    expect(effectiveUplift("greater_of", 4, null, 5.2).pct).toBe(5.2);
    expect(effectiveUplift("greater_of", 7, 6, 5.2).pct).toBe(6);
    expect(effectiveUplift("cpi", null, 3, 5.2).pct).toBe(3);
    expect(effectiveUplift("cpi", null, null, 5.2).pct).toBe(5.2);
    expect(effectiveUplift("fixed", 8, 5, 5.2).pct).toBe(5);
    expect(effectiveUplift("discretionary", null, 5).pct).toBe(5);
    expect(effectiveUplift("discretionary", null, null).pct).toBeNull();
    expect(effectiveUplift("none", null, null).pct).toBe(0);
  });
  it("FX and quote vs cap", () => {
    expect(toInr(45000, "USD", 84)).toBe(3780000);
    expect(() => toInr(1, "EUR")).toThrow();
    expect(quoteVsCap(2800000, 11, 5)).toEqual({ proposedAnnualInr: 3108000, maxAnnualAtCapInr: 2940000, excessOverCapInr: 168000 });
  });
  it("Indian formatting", () => {
    expect(formatINR(6200000)).toBe("₹62,00,000");
    expect(formatINRShort(434000)).toBe("₹4.34L");
  });
});

describe("benchmark", () => {
  const bm = [1900, 1950, 2000].map((r) => ({ role: "Sr", rate_inr_per_hr: r, source_supplier: "x" }));
  const line = { role_in_contract: "Sr", benchmark_role: "Sr", count: 1, rate_inr_per_hr: 2250, citation: { doc_id: "D", section: "1", quote: "q" } };
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("flags only with enough comparables and gap ≥ threshold", () => {
    expect(benchmarkGap(line, bm, { min_comparables: 3, benchmark_gap_pct: 10 })).toMatchObject({ gapPct: 15.38, flagged: true });
    expect(benchmarkGap(line, bm.slice(0, 2), { min_comparables: 3, benchmark_gap_pct: 10 }).flagged).toBe(false);
    expect(benchmarkGap({ ...line, rate_inr_per_hr: 2145 }, bm, { min_comparables: 3, benchmark_gap_pct: 10 })).toMatchObject({ gapPct: 10, flagged: true });
  });
});

describe("ledger", () => {
  const row = (p: string, amt: number, name = "ACME PRIVATE LIMITED"): LedgerRow => ({
    txn_id: p, erp_vendor_name: name, vendor_gstin: null, invoice_no: null, invoice_date: `${p}-01`, service_period: p,
    amount_pre_tax_inr: amt, gst_inr: Math.round(amt * 0.18), total_inr: Math.round(amt * 1.18), currency: "INR", amount_original: amt, cost_centre: null, po_ref: "PO-1",
  });
  const g = { l1_overspend_tolerance_pct: 10, l3_drift_tolerance_pct: 5, l3_min_consecutive_months: 3, l4_min_recurring_months: 3 };
  it("name matching", () => {
    expect(normName("Nimbus CRM Pvt. Ltd.")).toEqual(["NIMBUS", "CRM", "PRIVATE", "LIMITED"]);
    expect(sameVendor("BrightLoop Mktg", "BRIGHTLOOP MARKETING LLP")).toBe(true);
    expect(sameVendor("Acme", "Zenith")).toBe(false);
  });
  it("L3 needs 3 consecutive drifted months; 2 is not enough", () => {
    const rows = ["2026-01", "2026-02", "2026-03", "2026-04"].map((p, i) => row(p, i < 2 ? 100 : 120));
    expect(ledgerChecks({ rows, annualInr: 1200, monthlyInr: 100, renewalType: "auto", termEnd: "2027-01-01", hasTrackerRow: true, global: g }).l3).toBeNull();
    rows.push(row("2026-05", 120));
    expect(ledgerChecks({ rows, annualInr: 1200, monthlyInr: 100, renewalType: "auto", termEnd: "2027-01-01", hasTrackerRow: true, global: g }).l3).toMatchObject({ months: 3, excess_pre_tax_inr: 60 });
  });
  it("L1 overspend above tolerance", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`2026-${String(i + 1).padStart(2, "0")}`, 120));
    expect(ledgerChecks({ rows, annualInr: 1200, monthlyInr: 200, renewalType: "auto", termEnd: "2027-01-01", hasTrackerRow: true, global: g }).l1).toMatchObject({ overspend_inr: 240 });
  });
  it("L4: one-off vendor (2 months) is not recurring", () => {
    const ledger = [row("2026-02", 5, "INKWELL"), row("2026-09", 5, "INKWELL"), ...["2026-01", "2026-02", "2026-03"].map((p) => row(p, 9, "TALKWAVE"))];
    expect(untrackedRecurringVendors(ledger, [], 3)).toEqual(["TALKWAVE"]);
  });
});

describe("lanes", () => {
  const base = { annualInr: 1_000_000, greenMaxInr: 5_000_000, daysToActBy: 60, global: G };
  it.each([
    [["F1"], "green"],
    [[], "green"],
    [["F1", "F5"], "amber"],
    [["T1", "X2"], "amber"],
    [["F1", "F2"], "red"],
    [["F6"], "red"],
    [["L4", "T1"], "red"],
    [["X1", "F2"], "needs_review"],
  ] as const)("%j → %s", (flags, lane) => {
    expect(decideLane({ ...base, flags: [...flags] }).lane).toBe(lane);
  });
  it("≤14 days to act-by is red even with no flags", () => {
    expect(decideLane({ ...base, flags: ["F1"], daysToActBy: 14 }).lane).toBe("red");
    expect(decideLane({ ...base, flags: ["F1"], daysToActBy: 15 }).lane).toBe("green");
  });
  it("no flags but above green max → amber", () => {
    expect(decideLane({ ...base, flags: ["F1"], annualInr: 6_200_000 }).lane).toBe("amber");
  });
});
