import { ActorBadge } from "@/components/docket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINRShort } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import { getPortfolio } from "@/lib/portfolio";

export default async function Page() {
  const { policy } = await getPortfolio();
  const g = policy.global;
  return (
    <div className="space-y-6">
      <Card className="rounded-xl shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-navy">Category policy <ActorBadge actor="Rules" /> <span className="text-xs font-normal text-muted-foreground">read-only · policy.json</span></CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Uplift flag</TableHead>
                <TableHead className="text-right">Benchmark gap</TableHead>
                <TableHead className="text-right">Min comparables</TableHead>
                <TableHead className="text-right">Green max</TableHead>
                <TableHead className="text-right">Payment terms</TableHead>
                <TableHead>TfC required</TableHead>
                <TableHead className="text-right">Buffer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(policy.categories).map(([c, p]) => (
                <TableRow key={c}>
                  <TableCell className="font-medium text-navy">{CATEGORY_LABEL[c] ?? c}</TableCell>
                  <TableCell className="text-right tabular-nums">&gt; {p.uplift_flag_pct}%</TableCell>
                  <TableCell className="text-right tabular-nums">≥ {p.benchmark_gap_pct}%</TableCell>
                  <TableCell className="text-right tabular-nums">{p.min_comparables}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINRShort(p.green_max_annual_value_inr)}</TableCell>
                  <TableCell className="text-right tabular-nums">Net-{p.payment_terms_policy_days}</TableCell>
                  <TableCell>{p.tfc_required ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.internal_buffer_days}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Renewal horizon", `${g.renewal_horizon_days} days`],
          ["Red if act-by within", `${g.red_days_to_act_by} days`],
          ["Human review below", `${Math.round(g.confidence_min * 100)}% confidence`],
          ["Green undo window", `until act-by − ${g.auto_log_reversible_until_days_before_act_by}d`],
          ["L1 overspend tolerance", `${g.l1_overspend_tolerance_pct}%`],
          ["L3 drift", `> ${g.l3_drift_tolerance_pct}% for ${g.l3_min_consecutive_months}+ months`],
          ["L4 recurring", `${g.l4_min_recurring_months}+ months, no tracker row`],
          ["Minor flags (amber)", g.minor_flags.join(", ")],
          ["Special notice methods", g.special_notice_methods.join(", ").replace(/_/g, " ")],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="mt-1 text-sm font-semibold text-navy">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
