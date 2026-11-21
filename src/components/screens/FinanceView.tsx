"use client";

import { CheckCircle2, Receipt, XCircle } from "lucide-react";
import { useState } from "react";
import { ActorBadge, EmptyState, FlagChip, MiniBars, SourceChip } from "@/components/docket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/format";
import type { SupplierView } from "@/lib/seed";
import type { Flag } from "@/lib/types";
import { useDocketStore } from "@/store/useDocketStore";
import { toast } from "sonner";

export function FinanceView({ views }: { views: SupplierView[] }) {
  const alerts = views.flatMap((v) => v.flags.filter((f) => f.code.startsWith("L")).map((f) => ({ v, f, id: `${v.supplierId}-${f.code}` })));
  if (!alerts.length) return <EmptyState icon={Receipt} title="No billing alerts" />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Ledger vs contract checks. Confirming an alert attaches it to Procurement&apos;s decision card as evidence.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {alerts.map((a) => <AlertCard key={a.id} {...a} />)}
      </div>
    </div>
  );
}

function why(f: Flag): string {
  const d = (f.data ?? {}) as Record<string, unknown>;
  switch (f.code) {
    case "L2": return `Contract ended ${d.contract_end}; paid for ${(d.service_periods_after_expiry as string[])?.join(", ")} on ${d.po_ref}.`;
    case "L3": return `Billed ${formatINR(Number(d.billed_monthly_inr))}/mo vs ${formatINR(Number(d.contracted_monthly_inr))} since ${d.from_service_period} (+${d.drift_pct}%).`;
    case "L4": return `${d.recurring_months} months at ${formatINR(Number(d.monthly_pre_tax_inr))}, PO: ${d.po_ref}. Not in the tracker.`;
    case "L1": return `Spent ${formatINR(Number(d.total_pre_tax_inr))} vs ${formatINR(Number(d.annual_value_inr))} contracted.`;
    default: return f.detail;
  }
}

function AlertCard({ v, f, id }: { v: SupplierView; f: Flag; id: string }) {
  const confirmed = useDocketStore((s) => s.financeConfirmations[id]);
  const dismissed = useDocketStore((s) => s.financeDismissals[id]);
  const confirm = useDocketStore((s) => s.confirmFinance);
  const dismiss = useDocketStore((s) => s.dismissFinance);
  const [reason, setReason] = useState<string | null>(null);
  const requestId = `REQ-${v.supplierId}`;
  return (
    <Card className="rounded-xl shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-navy">
          <span>{v.name}</span>
          <span className="flex items-center gap-1.5"><FlagChip code={f.code} detail={f.detail} /><ActorBadge actor="Rules" /></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-semibold text-navy tabular-nums">{formatINR(f.impactInr ?? 0)}</span>
          <SourceChip source="ledger" />
        </div>
        <p className="text-sm text-navy">{why(f)}</p>
        <MiniBars months={v.ledgerMonths} contracted={v.money.monthlyInr} />
        {confirmed ? (
          <div className="flex items-center gap-2 text-sm font-medium text-lane-green"><CheckCircle2 className="size-4" /> Confirmed · attached to Priya&apos;s evidence pack</div>
        ) : dismissed ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><XCircle className="size-4" /> Dismissed: {dismissed.reason}</div>
        ) : reason !== null ? (
          <div className="space-y-2">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this not an issue? (e.g. approved variation on file)" />
            <div className="flex gap-2">
              <Button variant="secondary" disabled={!reason.trim()} onClick={() => { dismiss({ alertId: id, requestId, reason, by: "finance" }); toast("Alert dismissed"); }}>Dismiss</Button>
              <Button variant="ghost" onClick={() => setReason(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button onClick={() => { confirm({ alertId: id, requestId, flagCode: f.code, confirmedBy: "finance", note: why(f) }); toast.success("Confirmed · attached to Procurement's decision card"); }}>
              <CheckCircle2 /> Confirm
            </Button>
            <Button variant="outline" onClick={() => setReason("")}>Dismiss with reason</Button>
            <ActorBadge actor="finance" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
