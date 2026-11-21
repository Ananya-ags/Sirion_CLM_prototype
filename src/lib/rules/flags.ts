/**
 * Rules engine entry point: effective terms + ledger + tracker + policy → flags (with ₹ impact) and lane.
 * Pure: every input is passed in; no file or LLM access.
 */
import { DEMO_TODAY } from "../config";
import { FLAGS } from "../flags";
import { formatINR } from "../format";
import type {
  Benchmark,
  Category,
  EffectiveTerms,
  Field,
  Flag,
  FlagCode,
  Lane,
  LedgerRow,
  Policy,
  RateLine,
  TrackerRow,
  VendorQuote,
} from "../types";
import { actByInfo, earliestExit, type ActByInfo, type DayType } from "./actBy";
import { benchmarkGap, type BenchmarkResult } from "./benchmark";
import { decideLane } from "./lanes";
import { ledgerChecks, rowsForVendor, type LedgerResult } from "./ledger";
import { effectiveUplift, monthly, pctOf, quoteVsCap, toInr, type UpliftType } from "./money";
import { findTrackerRow, trackerConflicts, type TrackerConflict } from "./tracker";

export type RulesContext = {
  policy: Policy;
  benchmarks: Benchmark[];
  holidays: ReadonlySet<string>;
  ledger: LedgerRow[];
  tracker: TrackerRow[];
  usdInr: number;
  cpiPct: number;
  today?: string;
};

export type SupplierFacts = {
  supplierId: string;
  name: string;
  category: Category;
  terms: EffectiveTerms;
  quote?: VendorQuote;
  rateCard?: RateLine[];
  contractRef?: string | null;
};

export type SupplierEvaluation = {
  annualInr: number;
  monthlyInr: number;
  actBy: ActByInfo | null;
  earliestExit: string | null;
  uplift: { pct: number | null; basis: string; exposureInr: number | null };
  benchmarks: BenchmarkResult[];
  ledger: LedgerResult;
  trackerRow: TrackerRow | null;
  trackerConflicts: TrackerConflict[];
  flags: Flag[];
  lane: Lane;
  laneReason: string;
};

export const KEY_FIELDS = ["renewal_type", "initial_term_end", "renewal_term_months", "notice_days", "notice_day_type"] as const;

/** Guardrail 1: a value with no citation is not usable; treat it as unclear. */
export function usable<T>(f: Field<T>): T | "unclear" | null {
  if (f.value === "unclear") return "unclear";
  if (f.value !== null && !f.citation) return "unclear";
  return f.value;
}
const known = <T,>(f: Field<T>): T | null => {
  const v = usable(f);
  return v === "unclear" ? null : v;
};

export function evaluateSupplier(s: SupplierFacts, ctx: RulesContext): SupplierEvaluation {
  const today = ctx.today ?? DEMO_TODAY;
  const t = s.terms;
  const pc = ctx.policy.categories[s.category];
  if (!pc) throw new Error(`No policy for category ${s.category}`);
  const g = ctx.policy.global;
  const flags: Flag[] = [];
  const add = (code: FlagCode, detail: string, data?: Record<string, unknown>, impactInr?: number, evidence?: Flag["evidence"]) =>
    flags.push({ code, severity: FLAGS[code].severity, detail, data, impactInr, evidence });
  const cite = (...fs: Field<unknown>[]) => fs.map((f) => f.citation).filter((c): c is NonNullable<typeof c> => !!c);

  const rtype = usable(t.renewal_type);
  const currency = known(t.currency) ?? "INR";
  const annualInr = toInr(known(t.annual_value) ?? 0, currency, ctx.usdInr);
  const monthlyInr = monthly(annualInr);
  const termEnd = known(t.initial_term_end);
  const live = rtype !== "none";

  // Act-by
  const ab = actByInfo({
    renewalType: rtype,
    termEnd,
    noticeDays: known(t.notice_days),
    dayType: known(t.notice_day_type) as DayType | null,
    holidays: ctx.holidays,
    bufferDays: pc.internal_buffer_days,
    today,
  });
  if (ab && ab.daysToActBy >= 0 && ab.daysToActBy <= g.renewal_horizon_days) {
    add("F1", `Auto-renews; act by ${ab.actBy} (${ab.daysToActBy} days)`, { act_by_date: ab.actBy, days_to_act_by: ab.daysToActBy }, undefined, cite(t.notice_days));
  }
  const noticeDays = known(t.notice_days);
  const exit = rtype === "evergreen" && noticeDays != null ? earliestExit(noticeDays, today) : null;

  // X1: unclear / low-confidence key fields
  const unclear = KEY_FIELDS.filter((k) => usable(t[k] as Field<unknown>) === "unclear" || t[k].confidence < g.confidence_min);
  if (unclear.length) add("X1", `Unclear: ${unclear.join(", ")}`, { fields: unclear });

  // Uplift (F2)
  const up = effectiveUplift(
    (known(t.uplift.type) ?? "none") as UpliftType,
    known(t.uplift.value_pct),
    known(t.uplift.cap_pct),
    ctx.cpiPct,
  );
  const exposureInr = up.pct == null ? null : pctOf(annualInr, up.pct);
  if ((rtype === "auto" || rtype === "evergreen") && (up.pct == null || up.pct > pc.uplift_flag_pct)) {
    add(
      "F2",
      up.pct == null ? "Uncapped discretionary uplift" : `Uplift ${up.pct}% > ${pc.uplift_flag_pct}% threshold: ${formatINR(exposureInr!)}/yr`,
      { effective_uplift_pct: up.pct, basis: up.basis, exposure_inr: exposureInr, category_threshold_pct: pc.uplift_flag_pct },
      exposureInr ?? undefined,
      cite(t.uplift.type),
    );
  }

  // F3: vendor quote above the contract's cap
  const cap = known(t.uplift.cap_pct);
  if (s.quote && cap != null && s.quote.proposed_uplift_pct > cap) {
    const q = quoteVsCap(annualInr, s.quote.proposed_uplift_pct, cap);
    add(
      "F3",
      `Quote +${s.quote.proposed_uplift_pct}% vs cap ${cap}%: ${formatINR(q.excessOverCapInr)} over`,
      { quote_doc: s.quote.doc_id, proposed_uplift_pct: s.quote.proposed_uplift_pct, cap_pct: cap, proposed_annual_inr: q.proposedAnnualInr, max_annual_at_cap_inr: q.maxAnnualAtCapInr, excess_over_cap_inr: q.excessOverCapInr },
      q.excessOverCapInr,
      [s.quote.citation, ...cite(t.uplift.cap_pct)],
    );
  }

  // F4: benchmark
  const benchmarks = (s.rateCard ?? []).map((l) => benchmarkGap(l, ctx.benchmarks, pc));
  const over = benchmarks.filter((b) => b.flagged).sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0));
  if (over.length) {
    const top = over[0];
    const impact = over.reduce((a, b) => a + (b.annualGapInr ?? 0), 0);
    add(
      "F4",
      `${top.role} +${top.gapPct}% vs benchmark median`,
      { role: top.role, benchmark_role: top.benchmarkRole, contract_rate_inr_per_hr: top.rate, benchmark_median_inr_per_hr: top.median, n_comparables: top.comparables, gap_pct: top.gapPct, annual_gap_inr: impact },
      impact,
    );
  }

  // Contract-text flags (live contracts only)
  if (live && known(t.sla_credits) === false) add("F5", "No service credits for missed SLAs", {}, undefined, cite(t.sla_credits));
  if (live && known(t.tfc) === false && pc.tfc_required) {
    add("F6", "No termination for convenience (policy requires it)", { tfc: false, category_tfc_required: true, annual_value_inr: annualInr }, undefined, cite(t.tfc));
  }
  const pay = known(t.payment_terms_days);
  if (live && pay != null && pay < pc.payment_terms_policy_days) {
    add("F7", `Net-${pay} vs policy Net-${pc.payment_terms_policy_days}`, { payment_terms_days: pay, policy_days: pc.payment_terms_policy_days }, undefined, cite(t.payment_terms_days));
  }
  const method = known(t.notice_method);
  if (live && method && g.special_notice_methods.includes(method)) {
    add("X2", `Notice only by ${method.replace(/_/g, " ")}`, { notice_method: method, notice_address: known(t.notice_address) }, undefined, cite(t.notice_method, t.notice_address));
  }

  // Ledger + tracker
  const trackerRow = findTrackerRow(ctx.tracker, s.name);
  const ledger = ledgerChecks({
    rows: rowsForVendor(ctx.ledger, s.name),
    annualInr,
    monthlyInr,
    renewalType: rtype,
    termEnd,
    hasTrackerRow: !!trackerRow,
    global: g,
  });
  if (ledger.l1) add("L1", `Spend ${formatINR(ledger.l1.total_pre_tax_inr)} vs contract ${formatINR(annualInr)}`, ledger.l1, ledger.l1.overspend_inr);
  if (ledger.l2) add("L2", `Paid ${ledger.l2.service_periods_after_expiry.length} months after expiry`, ledger.l2, ledger.l2.total_incl_gst_inr);
  if (ledger.l3) add("L3", `Billed +${ledger.l3.drift_pct}% for ${ledger.l3.months} months`, ledger.l3, ledger.l3.excess_pre_tax_inr);
  if (ledger.l4) add("L4", `${ledger.l4.recurring_months} months of spend, not in tracker`, ledger.l4, ledger.l4.total_pre_tax_inr);

  const conflicts = trackerConflicts(
    trackerRow,
    {
      contractRef: s.contractRef,
      renewalType: rtype,
      termEnd,
      noticeDays,
      annualInr,
      sources: {
        renewal_type: t.renewal_type.citation?.doc_id,
        initial_term_end: t.initial_term_end.citation?.doc_id,
        notice_days: t.notice_days.overridden_by ?? t.notice_days.citation?.doc_id,
        annual_value: t.annual_value.citation?.doc_id,
      },
    },
    today,
  );
  if (conflicts.length) add("T1", `${conflicts.length} tracker conflict${conflicts.length > 1 ? "s" : ""}`, { conflicts });

  const { lane, reason } = decideLane({
    flags: flags.map((f) => f.code),
    annualInr,
    greenMaxInr: pc.green_max_annual_value_inr,
    daysToActBy: ab?.daysToActBy ?? null,
    global: g,
  });

  return {
    annualInr,
    monthlyInr,
    actBy: ab,
    earliestExit: exit,
    uplift: { ...up, exposureInr },
    benchmarks,
    ledger,
    trackerRow,
    trackerConflicts: conflicts,
    flags,
    lane,
    laneReason: reason,
  };
}
