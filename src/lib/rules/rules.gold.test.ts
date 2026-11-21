/**
 * Golden tests: for EVERY supplier in dev_gold.json the Rules must reproduce the gold
 * act-by, ₹ figures, flag set and lane. Gold is the source of truth; never edit it to pass.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { loadDevGold } from "../data";
import { goldToExtraction, loadRulesContext } from "../seed";
import type { DevGoldSupplier } from "../types";
import { computeActBy } from "./actBy";
import { evaluateSupplier, type RulesContext, type SupplierEvaluation } from "./flags";

let ctx: RulesContext;
let gold: DevGoldSupplier[];
const results = new Map<string, SupplierEvaluation>();

beforeAll(async () => {
  ctx = await loadRulesContext();
  gold = (await loadDevGold()).suppliers;
  for (const g of gold) {
    const ex = goldToExtraction(g);
    results.set(g.supplier_id, evaluateSupplier({ supplierId: g.supplier_id, name: g.contract_name, category: g.category, terms: ex.effective_terms, quote: ex.quote, rateCard: ex.rate_card }, ctx));
  }
});

const IDS = Array.from({ length: 10 }, (_, i) => `SUP-${String(i + 1).padStart(2, "0")}`);
const G = (id: string) => gold.find((g) => g.supplier_id === id)!;
const R = (id: string) => results.get(id)!;
const flagData = (id: string, code: string) => R(id).flags.find((f) => f.code === code)?.data;
const goldFlag = (id: string, code: string) => G(id).expected_flags.find((f) => f.code === code)?.detail as Record<string, unknown>;

describe("dev gold: every supplier", () => {
  it("covers all 10 suppliers", () => {
    expect(gold.map((g) => g.supplier_id)).toEqual(IDS);
  });

  describe.each(IDS)("%s", (id) => {
    it("act-by, days left, decision target", () => {
      const c = G(id).computed;
      expect(R(id).actBy?.actBy ?? null).toBe(c.act_by_date);
      expect(R(id).actBy?.daysToActBy ?? null).toBe(c.days_to_act_by);
      if (c.decision_target_date) expect(R(id).actBy?.decisionTarget).toBe(c.decision_target_date);
      if (c.decision_target_passed !== undefined) expect(R(id).actBy?.decisionTargetPassed).toBe(c.decision_target_passed);
      if (c.act_by_is_business_day !== undefined) expect(R(id).actBy?.actByIsBusinessDay).toBe(c.act_by_is_business_day);
    });

    it("₹ figures: annual, monthly, uplift % and exposure", () => {
      const c = G(id).computed;
      expect(R(id).annualInr).toBe(c.annual_value_inr);
      expect(R(id).monthlyInr).toBe(c.monthly_contract_value_inr);
      expect(R(id).uplift.pct).toBe(c.effective_uplift_pct);
      expect(R(id).uplift.exposureInr).toBe(c.uplift_exposure_inr);
      expect(R(id).uplift.basis).toBe(c.uplift_basis);
    });

    it("ledger summary", () => {
      const l = (G(id).computed as unknown as { ledger: { invoices: number; total_pre_tax_inr: number; service_periods: string[] } }).ledger;
      expect(R(id).ledger.summary.invoices).toBe(l.invoices);
      expect(R(id).ledger.summary.total_pre_tax_inr).toBe(l.total_pre_tax_inr);
      expect(R(id).ledger.summary.service_periods).toEqual(l.service_periods);
    });

    it("flag set", () => {
      expect(R(id).flags.map((f) => f.code).sort()).toEqual(G(id).expected_flags.map((f) => f.code).sort());
    });

    it("lane", () => {
      expect(R(id).lane).toBe(G(id).expected_lane);
    });
  });
});

describe("dev gold: flag ₹ details", () => {
  it("SUP-01 F2 exposure ₹4,34,000 and L3 drift", () => {
    expect(flagData("SUP-01", "F2")).toMatchObject({ effective_uplift_pct: 7, exposure_inr: 434000, category_threshold_pct: 6 });
    const g = goldFlag("SUP-01", "L3");
    expect(flagData("SUP-01", "L3")).toMatchObject({
      from_service_period: g.from_service_period,
      months: g.months,
      contracted_monthly_inr: g.contracted_monthly_inr,
      billed_monthly_inr: g.billed_monthly_inr,
      drift_pct: g.drift_pct,
      excess_pre_tax_inr: g.excess_pre_tax_inr,
    });
    expect(R("SUP-01").flags.find((f) => f.code === "L3")?.impactInr).toBe(279000);
  });

  it("SUP-02 F3 quote vs cap", () => {
    const g = goldFlag("SUP-02", "F3");
    expect(flagData("SUP-02", "F3")).toMatchObject({
      quote_doc: g.quote_doc,
      proposed_uplift_pct: g.proposed_uplift_pct,
      cap_pct: g.cap_pct,
      proposed_annual_inr: g.proposed_annual_inr,
      max_annual_at_cap_inr: g.max_annual_at_cap_inr,
      excess_over_cap_inr: g.excess_over_cap_inr,
    });
  });

  it("SUP-03 F4 uses the amended ₹2,250 rate; DevOps (2 comparables) not flagged", () => {
    const g = goldFlag("SUP-03", "F4");
    expect(flagData("SUP-03", "F4")).toMatchObject({
      contract_rate_inr_per_hr: g.contract_rate_inr_per_hr,
      benchmark_median_inr_per_hr: g.benchmark_median_inr_per_hr,
      n_comparables: g.n_comparables,
      gap_pct: g.gap_pct,
      annual_gap_inr: g.annual_gap_inr,
    });
    const devops = R("SUP-03").benchmarks.find((b) => b.benchmarkRole === "DevOps Engineer")!;
    expect(devops.comparables).toBe(2);
    expect(devops.flagged).toBe(false);
  });

  it("T1 conflicts match gold fields (4 field-level conflicts across 3 suppliers)", () => {
    for (const id of ["SUP-03", "SUP-04", "SUP-09"]) {
      const g = (goldFlag(id, "T1") as unknown as { field: string }[]).map((c) => c.field).sort();
      expect(R(id).trackerConflicts.map((c) => c.field).sort(), id).toEqual(g);
    }
    expect(IDS.reduce((n, id) => n + R(id).trackerConflicts.length, 0)).toBe(4);
  });

  it("SUP-03 T1 cites the amendment as source", () => {
    expect(R("SUP-03").trackerConflicts[0]).toMatchObject({ field: "notice_days", tracker_value: 30, contract_value: 60, source: "DOC-11" });
  });

  it("SUP-04 X2 registered post; evergreen earliest exit", () => {
    expect(flagData("SUP-04", "X2")).toMatchObject({ notice_method: "registered_post" });
    expect(R("SUP-04").earliestExit).toBe((G("SUP-04").computed as unknown as { earliest_exit_if_notice_on_demo_today: string }).earliest_exit_if_notice_on_demo_today);
  });

  it("SUP-07 USD 45,000 × ₹84", () => {
    expect(R("SUP-07").annualInr).toBe(3780000);
  });

  it("SUP-08 X1 on renewal_type and renewal_term_months", () => {
    expect(flagData("SUP-08", "X1")).toEqual({ fields: goldFlag("SUP-08", "X1").fields });
  });

  it("SUP-09 L4 untracked recurring spend", () => {
    const g = goldFlag("SUP-09", "L4");
    expect(flagData("SUP-09", "L4")).toMatchObject({
      erp_vendor_name: g.erp_vendor_name,
      recurring_months: g.recurring_months,
      monthly_pre_tax_inr: g.monthly_pre_tax_inr,
      total_pre_tax_inr: g.total_pre_tax_inr,
      po_ref: g.po_ref,
    });
  });

  it("SUP-10 L2 paid after expiry (₹11.8L incl. GST)", () => {
    const g = goldFlag("SUP-10", "L2");
    expect(flagData("SUP-10", "L2")).toMatchObject({
      contract_end: g.contract_end,
      service_periods_after_expiry: g.service_periods_after_expiry,
      monthly_pre_tax_inr: g.monthly_pre_tax_inr,
      total_pre_tax_inr: g.total_pre_tax_inr,
      total_incl_gst_inr: g.total_incl_gst_inr,
    });
  });

  it("BrightLoop (SUP-06): 60 business days → 2026-11-30; misreadings differ", () => {
    const c = G("SUP-06").computed as unknown as { comparison_if_misread: { as_calendar_days: string; business_days_ignoring_holidays: string } };
    expect(computeActBy("2027-02-26", 60, "business", ctx.holidays)).toBe("2026-11-30");
    expect(computeActBy("2027-02-26", 60, "calendar", ctx.holidays)).toBe(c.comparison_if_misread.as_calendar_days);
    expect(computeActBy("2027-02-26", 60, "business", new Set())).toBe(c.comparison_if_misread.business_days_ignoring_holidays);
  });

  it("SUP-08 provisional continuation reading would be 2026-12-01", () => {
    expect(computeActBy("2027-01-15", 45, "calendar", ctx.holidays)).toBe((G("SUP-08").computed as unknown as { provisional_act_by_if_continuation_reading: string }).provisional_act_by_if_continuation_reading);
  });
});
