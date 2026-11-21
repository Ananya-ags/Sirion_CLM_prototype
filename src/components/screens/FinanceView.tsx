"use client";

import { Activity, CalendarRange, CheckCircle2, Receipt, XCircle } from "lucide-react";
import { useState } from "react";
import { ActorBadge, EmptyState, FlagChip, MiniBars, SourceChip } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/format";
import { metricLabel, monthLabel } from "@/lib/labels";
import type { SupplierView } from "@/lib/seed";
import type { Flag } from "@/lib/types";
import { useDocketStore } from "@/store/useDocketStore";
import { toast } from "sonner";

export function FinanceView({ views }: { views: SupplierView[] }) {
  const alerts = views.flatMap((v) => v.flags.filter((f) => f.code.startsWith("L") || f.code === "S1").map((f) => ({ v, f, id: `${v.supplierId}-${f.code}` })));
  if (!alerts.length) return <EmptyState icon={Receipt} title="No billing alerts" />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Ledger vs contract checks and unclaimed SLA credits. Confirming an alert attaches it to Procurement&apos;s decision card as evidence.</p>
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
    case "S1": return `Missed SLA in ${(d.months as string[]).map(monthLabel).join(" + ")}; credit due on the contracted fee, no credit note in the ledger.`;
    default: return f.detail;
  }
}

function AlertCard({ v, f, id }: { v: SupplierView; f: Flag; id: string }) {
  const confirmed = useDocketStore((s) => s.financeConfirmations[id]);
  const dismissed = useDocketStore((s) => s.financeDismissals[id]);
  const confirm = useDocketStore((s) => s.confirmFinance);
  const dismiss = useDocketStore((s) => s.dismissFinance);
  const [reason, setReason] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const requestId = `REQ-${v.supplierId}`;
  const isSla = f.code === "S1";
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
          <span className="flex items-center gap-1.5">
            {isSla && <Badge variant="secondary" className="gap-1"><Activity className="size-3" /> SLA report</Badge>}
            <SourceChip source="ledger" />
          </span>
        </div>
        {isSla && <div className="text-sm font-medium text-navy">{f.detail}</div>}
        <p className="text-sm text-navy">{why(f)}</p>
        {isSla ? (
          <Button variant="outline" size="sm" onClick={() => setDrawer(true)}><CalendarRange /> Month detail</Button>
        ) : (
          <MiniBars months={v.ledgerMonths} contracted={v.money.monthlyInr} />
        )}
        {isSla && <SlaDrawer open={drawer} onOpenChange={setDrawer} v={v} f={f} />}
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

type Breach = { month: string; metric: string; target: number; actual: number; credit_pct: number; credit_due_inr: number; credit_due_original: number; currency: string };

function SlaDrawer({ open, onOpenChange, v, f }: { open: boolean; onOpenChange: (o: boolean) => void; v: SupplierView; f: Flag }) {
  const breaches = ((f.data?.breaches ?? []) as Breach[]).slice().sort((a, b) => a.month.localeCompare(b.month));
  const sla = v.sla;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{v.name} · SLA credits</SheetTitle>
          <SheetDescription>{f.detail}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ActorBadge actor="Rules" /> credit % from the contract table × contracted monthly fee
            {sla?.citation && <span>· {sla.citation.doc_id} §{sla.citation.section}</span>}
          </div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Month</TableHead><TableHead>Target</TableHead><TableHead>Actual</TableHead><TableHead>Credit</TableHead><TableHead className="text-right">Due</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {breaches.map((b) => (
                <TableRow key={b.month + b.metric}>
                  <TableCell>{monthLabel(b.month)}</TableCell>
                  <TableCell>{b.target}%</TableCell>
                  <TableCell className="font-medium text-lane-amber">{b.actual}%</TableCell>
                  <TableCell>{b.credit_pct}%</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatINR(b.credit_due_inr)}{b.currency !== "INR" && <span className="block text-[11px] text-muted-foreground">{b.currency} {b.credit_due_original}</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {sla && (
            <p className="text-xs text-muted-foreground">
              {metricLabel(sla.metric)}: {sla.monthsMet} of {sla.monthsReported} months met · ledger has no credit note (CN-) for these service periods.
            </p>
          )}
          {sla?.citation && <blockquote className="rounded-lg border-l-4 border-brand bg-surface p-3 text-sm text-navy italic">“{sla.citation.quote}”</blockquote>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
