"use client";

import { CalendarRange, CheckCircle2, ChevronDown, Receipt, XCircle } from "lucide-react";
import { useState } from "react";
import { ActorBadge, EmptyState, Hint, MiniBars, SourceChip } from "@/components/docket";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatINR } from "@/lib/format";
import { metricLabel, monthLabel, monthList } from "@/lib/labels";
import { FINANCE_TITLE } from "@/lib/plain";
import type { SupplierView } from "@/lib/seed";
import type { Flag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDocketStore } from "@/store/useDocketStore";
import { toast } from "sonner";

export function FinanceView({ views }: { views: SupplierView[] }) {
  const alerts = views.flatMap((v) => v.flags.filter((f) => f.code.startsWith("L") || f.code === "S1").map((f) => ({ v, f, id: `${v.supplierId}-${f.code}` })));
  if (!alerts.length) return <EmptyState icon={Receipt} title="Nothing waiting on you" description="Billing checks against the contract appear here." />;
  return (
    <div className="space-y-6">
      <p className="text-base text-slate-700">Invoices checked against the signed contract. Confirming sends the evidence to Procurement.</p>
      <div className="grid gap-5 lg:grid-cols-2">
        {alerts.map((a) => <AlertCard key={a.id} {...a} />)}
      </div>
    </div>
  );
}

/** One plain line per alert (numbers from Rules). */
function why(f: Flag): string {
  const d = (f.data ?? {}) as Record<string, unknown>;
  switch (f.code) {
    case "L2": return `Contract ended ${formatDate(String(d.contract_end))}; still paid for ${(d.service_periods_after_expiry as string[])?.length} months.`;
    case "L3": return `Billed ${formatINR(Number(d.billed_monthly_inr))} a month vs ${formatINR(Number(d.contracted_monthly_inr))} agreed (+${d.drift_pct}%).`;
    case "L4": return `${d.recurring_months} months at ${formatINR(Number(d.monthly_pre_tax_inr))}, no PO, not on the tracker.`;
    case "L1": return `Spent ${formatINR(Number(d.total_pre_tax_inr))} vs ${formatINR(Number(d.annual_value_inr))} contracted.`;
    case "S1": return `Missed the service level in ${monthList(d.months as string[])}; no credit note received.`;
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
    <div data-tour={`alert-${id}`} className={cn("flex flex-col rounded-xl border bg-card p-6 shadow-soft", confirmed && "border-lane-green/40")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-slate-600">{v.name}</div>
          <h3 className="text-lg font-semibold">{FINANCE_TITLE[f.code] ?? f.detail}</h3>
        </div>
        <Hint content={isSla ? "Source: monthly SLA reports + ledger" : "Source: AP ledger vs the signed contract"}>
          <span><SourceChip source="ledger" /></span>
        </Hint>
      </div>
      <div className="mt-3 text-[2rem] leading-tight font-semibold text-navy tabular-nums">{formatINR(f.impactInr ?? 0)}</div>
      <p className="mt-1 text-base text-slate-700">{why(f)}</p>

      {isSla ? (
        <button onClick={() => setDrawer(true)} className="mt-2 inline-flex w-fit items-center gap-1 text-sm font-medium text-brand hover:underline"><CalendarRange className="size-4" /> Month detail</button>
      ) : (
        <details className="group mt-2">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-brand">Billing by month <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-2"><MiniBars months={v.ledgerMonths} contracted={v.money.monthlyInr} /></div>
        </details>
      )}
      {isSla && <SlaDrawer open={drawer} onOpenChange={setDrawer} v={v} f={f} />}

      <div className="mt-auto pt-4">
        {confirmed ? (
          <div className="flex items-center gap-2 text-base font-medium text-lane-green"><CheckCircle2 className="size-5" /> Confirmed · sent to Procurement</div>
        ) : dismissed ? (
          <div className="flex items-center gap-2 text-base text-slate-600"><XCircle className="size-5" /> Dismissed: {dismissed.reason}</div>
        ) : reason !== null ? (
          <div className="space-y-2">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this not an issue? (e.g. approved variation on file)" />
            <div className="flex gap-2">
              <Button variant="secondary" disabled={!reason.trim()} onClick={() => { dismiss({ alertId: id, requestId, reason, by: "finance" }); toast("Alert dismissed"); }}>Dismiss</Button>
              <Button variant="ghost" onClick={() => setReason(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => { confirm({ alertId: id, requestId, flagCode: f.code, confirmedBy: "finance", note: why(f) }); toast.success("Confirmed · sent to Procurement"); }}>
              <CheckCircle2 /> Confirm
            </Button>
            <Button size="lg" variant="outline" onClick={() => setReason("")}>Dismiss</Button>
          </div>
        )}
      </div>
    </div>
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
                  <TableCell className="text-right font-medium tabular-nums">{formatINR(b.credit_due_inr)}{b.currency !== "INR" && <span className="block text-xs text-muted-foreground">{b.currency} {b.credit_due_original}</span>}</TableCell>
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
