"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { useState } from "react";
import { ActorBadge, Hint } from "@/components/docket";
import { Button } from "@/components/ui/button";
import { formatINRShort } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import type { Policy } from "@/lib/types";

/** Category policy in plain language, with the raw policy.json values one toggle away. */
export function PolicyView({ policy }: { policy: Policy }) {
  const [table, setTable] = useState(false);
  const g = policy.global;
  const cats = Object.entries(policy.categories);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-base text-slate-700">
          <ActorBadge actor="Rules" /> Rules Docket applies; set by Procurement, read-only in this demo.
        </p>
        <Button variant="outline" onClick={() => setTable((t) => !t)}>
          {table ? <LayoutGrid /> : <Table2 />} {table ? "View as cards" : "View as table"}
        </Button>
      </div>

      {table ? (
        <div className="overflow-auto rounded-xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-white">
              <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {["Category", "Uplift flag", "Benchmark gap", "Min comparables", "Auto-clear up to", "Payment terms", "Exit right required", "Decision buffer"].map((h, i) => (
                  <th key={h} className={i > 0 && i !== 6 ? "px-3 py-3 text-right" : "px-4 py-3"}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map(([c, p]) => (
                <tr key={c} className="border-t">
                  <td className="px-4 py-2.5 font-medium text-navy">{CATEGORY_LABEL[c] ?? c}</td>
                  <td className="px-3 text-right tabular-nums">&gt; {p.uplift_flag_pct}%</td>
                  <td className="px-3 text-right tabular-nums">≥ {p.benchmark_gap_pct}%</td>
                  <td className="px-3 text-right tabular-nums">{p.min_comparables}</td>
                  <td className="px-3 text-right tabular-nums">{formatINRShort(p.green_max_annual_value_inr)}</td>
                  <td className="px-3 text-right tabular-nums">Net-{p.payment_terms_policy_days}</td>
                  <td className="px-4">{p.tfc_required ? "Yes" : "No"}</td>
                  <td className="px-3 text-right tabular-nums">{p.internal_buffer_days} days</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cats.map(([c, p]) => (
            <div key={c} className="rounded-xl border bg-card p-5 shadow-soft">
              <h3 className="text-lg font-semibold">{CATEGORY_LABEL[c] ?? c}</h3>
              <ul className="mt-3 space-y-2 text-base text-slate-800">
                <Rule k="Flag price rises above" v={`${p.uplift_flag_pct}%`} />
                <Rule k="Auto-clear up to" v={`${formatINRShort(p.green_max_annual_value_inr)}/yr`} />
                <Rule k="Flag payment terms below" v={`${p.payment_terms_policy_days} days`} />
                <Rule k="Rate check" v={`≥ ${p.min_comparables} comparables`} hint={`Flag rates ≥ ${p.benchmark_gap_pct}% above the benchmark median`} />
                {p.tfc_required && <Rule k="Exit-early right" v="required" />}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border-2 border-brand/15 bg-surface p-5">
        <h3 className="text-lg font-semibold">Everywhere</h3>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-base text-slate-800 md:grid-cols-2">
          <Rule k="Renewals raised" v={`${g.renewal_horizon_days} days before act-by`} />
          <Rule k="Decision target" v={`act-by − ${[...new Set(cats.map(([, p]) => p.internal_buffer_days))].join("/")} days`} />
          <Rule k="Red lane when act-by is within" v={`${g.red_days_to_act_by} days`} />
          <Rule k="Human review when" v="OCR · unverified · unclear · missing" />
          <Rule k="Green renewals reversible until" v={`act-by − ${g.auto_log_reversible_until_days_before_act_by} days`} />
          <Rule k="Overspend flagged above" v={`${g.l1_overspend_tolerance_pct}% of contract value`} />
          <Rule k="Billing drift" v={`> ${g.l3_drift_tolerance_pct}% for ${g.l3_min_consecutive_months}+ months`} />
          <Rule k="Untracked spend" v={`${g.l4_min_recurring_months}+ months with no tracker row`} />
          <Rule k="SLA credits" v={`red at ${g.sla_breach_months_red}+ breach months (critical vendors)`} />
          <Rule k="Low utilisation" v={`< ${g.utilisation_flag_pct}% for ${g.utilisation_min_months}+ months`} />
        </ul>
      </div>
    </div>
  );
}

function Rule({ k, v, hint }: { k: string; v: string; hint?: string }) {
  const value = <span className="text-right font-semibold text-navy">{v}</span>;
  return (
    <li className="flex list-none items-baseline justify-between gap-3 border-b border-dashed border-border pb-1.5 last:border-0">
      <span className="text-slate-600">{k}</span>
      {hint ? <Hint content={hint}>{value}</Hint> : value}
    </li>
  );
}
