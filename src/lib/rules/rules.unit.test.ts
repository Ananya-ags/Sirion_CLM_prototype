import { describe, expect, it } from "vitest";
import type { LedgerRow } from "../types";
import { actByInfo, addDays, computeActBy, daysBetween, isBusinessDay } from "./actBy";
import { benchmarkGap, median } from "./benchmark";
import { decideLane } from "./lanes";
import { isCreditNote, ledgerChecks, normName, sameVendor, untrackedRecurringVendors } from "./ledger";
import { breachMonthsIn12, slaCredits, utilisation } from "./performance";
import { effectiveUplift, formatINR, formatINRShort, quoteVsCap, toInr } from "./money";

// Subset of holidays.json used in these edge cases.
const H = new Set(["2026-12-25", "2027-01-01", "2027-01-15", "2027-01-26", "2026-11-09", "2026-11-10"]);
const G = { red_days_to_act_by: 14, minor_flags: ["F5", "F7", "X2", "T1", "S1", "U1"] };

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

  describe("credit notes (CN- invoice_no, negative amounts)", () => {
    const cn = (p: string, amt: number, name = "ACME PRIVATE LIMITED"): LedgerRow => ({ ...row(p, -amt, name), txn_id: `CN-${p}`, invoice_no: `CN-AC-${p}` });
    const run = (rows: LedgerRow[], over: Partial<Parameters<typeof ledgerChecks>[0]> = {}) =>
      ledgerChecks({ rows, annualInr: 1200, monthlyInr: 100, renewalType: "auto", termEnd: "2027-01-01", hasTrackerRow: true, global: g, ...over });
    const months = (n: number, amt: number) => Array.from({ length: n }, (_, i) => row(`2026-${String(i + 1).padStart(2, "0")}`, amt));

    it("identifies CN- rows only", () => {
      expect(isCreditNote(cn("2026-01", 10))).toBe(true);
      expect(isCreditNote(row("2026-01", 10))).toBe(false);
      expect(isCreditNote({ invoice_no: "INV-CN-1" })).toBe(false);
    });
    it("L1 nets the credit note off the total", () => {
      // 12 × 140 = 1,680 > 1,320 (1,200 + 10%) → L1; a 400 credit brings it to 1,280 → no L1
      expect(run(months(12, 140)).l1).toMatchObject({ total_pre_tax_inr: 1680 });
      expect(run([...months(12, 140), cn("2026-07", 400)]).l1).toBeNull();
      expect(run([...months(12, 140), cn("2026-07", 100)]).l1).toMatchObject({ total_pre_tax_inr: 1580, overspend_inr: 380 });
    });
    it("L3 ignores the credit note (it does not break a drift run or lower the billed amount)", () => {
      const rows = [...months(4, 120), cn("2026-02", 30)];
      expect(run(rows).l3).toMatchObject({ months: 4, billed_monthly_inr: 120, excess_pre_tax_inr: 80 });
    });
    it("L4 does not count a credit-note month as a separate recurring month; most common amount excludes it", () => {
      const two = [row("2026-01", 50), row("2026-02", 50), cn("2026-03", 50), cn("2026-04", 50)];
      expect(run(two, { hasTrackerRow: false }).l4).toBeNull();
      const three = [...months(3, 50), cn("2026-02", 50), cn("2026-03", 50)];
      expect(run(three, { hasTrackerRow: false }).l4).toMatchObject({ recurring_months: 3, monthly_pre_tax_inr: 50, total_pre_tax_inr: 50 });
      expect(untrackedRecurringVendors([...two], [], 3)).toEqual([]);
    });
    it("summary: distinct billed periods; credit notes listed separately", () => {
      const s = run([...months(3, 100), cn("2026-02", 10)]).summary;
      expect(s.service_periods).toEqual(["2026-01", "2026-02", "2026-03"]);
      expect(s.invoices).toBe(4);
      expect(s.total_pre_tax_inr).toBe(290);
      expect(s.credit_notes).toEqual({ count: 1, total_pre_tax_inr: -10, service_periods: ["2026-02"] });
    });
  });
});

describe("S1 SLA credits", () => {
  const terms = {
    metric: "uptime_pct", target: 99.5, currency: "INR", fee_basis_monthly: 100000,
    credit_rule: [{ from_incl: 99, to_excl: 99.5, credit_pct: 5 }, { from_incl: 98, to_excl: 99, credit_pct: 10 }, { from_incl: 0, to_excl: 98, credit_pct: 20 }],
  };
  const sla = (month: string, actual: number, metric = "uptime_pct") => ({ report_id: month, vendor_id: "V", erp_vendor_name: "ACME", month, metric, target: 99.5, actual, unit: "pct", source: "vendor_monthly_report", reported_date: `${month}-28` });
  it("credit % × contracted fee; band edges are from-inclusive", () => {
    const r = slaCredits({ terms, rows: [sla("2026-01", 99.5), sla("2026-02", 99.0), sla("2026-03", 98.99), sla("2026-04", 97)], creditNotePeriods: new Set(), usdInr: 84 });
    expect(r.breaches.map((b) => [b.month, b.credit_pct, b.credit_due_inr])).toEqual([["2026-02", 5, 5000], ["2026-03", 10, 10000], ["2026-04", 20, 20000]]);
    expect(r.monthsMet).toBe(1);
    expect(breachMonthsIn12(r)).toBe(3);
  });
  it("a CN- for the service period marks the credit claimed", () => {
    const r = slaCredits({ terms, rows: [sla("2026-02", 99.0), sla("2026-03", 99.0)], creditNotePeriods: new Set(["2026-02"]), usdInr: 84 });
    expect([r.creditsDueInr, r.creditsClaimedInr, r.unclaimedInr, r.unclaimedMonths]).toEqual([10000, 5000, 5000, ["2026-03"]]);
  });
  it("USD fee converts at fx; a text-only credit rule computes nothing", () => {
    const usd = slaCredits({ terms: { ...terms, currency: "USD", fee_basis_monthly: 3750 }, rows: [sla("2026-07", 99.2)], creditNotePeriods: new Set(), usdInr: 84 });
    expect(usd.breaches[0]).toMatchObject({ credit_due_original: 187.5, credit_due_inr: 15750 });
    const text = slaCredits({ terms: { ...terms, credit_rule: "2% per point" }, rows: [sla("2026-07", 90)], creditNotePeriods: new Set(), usdInr: 84 });
    expect(text.noCreditTable).toBe(true);
    expect(text.unclaimedInr).toBe(0);
  });
  it("per-circuit metrics (metric:<id>) match the contract metric", () => {
    const r = slaCredits({ terms, rows: [sla("2026-01", 99.9, "uptime_pct:C1"), sla("2026-01", 99.2, "uptime_pct:C2"), sla("2026-01", 90, "other")], creditNotePeriods: new Set(), usdInr: 84 });
    expect(r.monthsReported).toBe(1);
    expect(r.breaches).toHaveLength(1);
  });
});

describe("U1 utilisation", () => {
  const use = (month: string, active: number, licensed = 100, metric = "seats") => ({ usage_id: month, vendor_id: "V", erp_vendor_name: "ACME", month, metric, licensed_units: licensed, active_units: active, source: "admin_console" });
  const base = { licensed: [{ metric: "seats", licensed_units: 100 }, { metric: "agents", licensed_units: 100 }], annualInr: 200_000, flagPct: 80, minMonths: 3 };
  it("fires at ≥ 3 consecutive latest months below 80%; impact = avg unused × annual ÷ total licensed", () => {
    const r = utilisation({ ...base, rows: ["01", "02", "03", "04"].map((m, i) => use(`2026-${m}`, [90, 70, 75, 65][i])) })!;
    const l = r.lines[0];
    expect([l.flagged, l.months_below, l.avg_active_last_n, l.unused_units]).toEqual([true, 3, 70, 30]);
    expect(l.unused_value_inr).toBe(30_000); // 30 × (2,00,000 ÷ 200)
    expect(r.unusedValueInr).toBe(30_000);
  });
  it("2 latest months below is not enough; a recovery resets the run", () => {
    expect(utilisation({ ...base, rows: ["01", "02", "03"].map((m, i) => use(`2026-${m}`, [90, 70, 75][i])) })!.lines[0].flagged).toBe(false);
    expect(utilisation({ ...base, rows: ["01", "02", "03", "04"].map((m, i) => use(`2026-${m}`, [70, 70, 70, 85][i])) })!.lines[0].flagged).toBe(false);
  });
  it("no licensed lines → null", () => {
    expect(utilisation({ ...base, licensed: [], rows: [] })).toBeNull();
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
    [["F1", "S1", "U1"], "amber"],
    [["F1", "F2", "L3", "S1", "U1"], "red"],
  ] as const)("%j → %s", (flags, lane) => {
    expect(decideLane({ ...base, flags: [...flags] }).lane).toBe(lane);
  });
  it("≤14 days to act-by is red even with no flags", () => {
    expect(decideLane({ ...base, flags: ["F1"], daysToActBy: 14 }).lane).toBe("red");
    expect(decideLane({ ...base, flags: ["F1"], daysToActBy: 15 }).lane).toBe("green");
  });
  it("S1 escalated by Rules (≥3 breach months, high criticality) → red", () => {
    expect(decideLane({ ...base, flags: ["F1", "S1"], escalated: ["S1"] }).lane).toBe("red");
  });
  it("no flags but above green max → amber", () => {
    expect(decideLane({ ...base, flags: ["F1"], annualInr: 6_200_000 }).lane).toBe("amber");
  });
});
