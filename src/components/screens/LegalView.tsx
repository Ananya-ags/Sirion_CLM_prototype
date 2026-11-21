"use client";

import { AlertTriangle, CheckCircle2, Lock, MoreHorizontal, Scale, Send, Sparkles, Undo2 } from "lucide-react";
import { useState } from "react";
import { EmptyState, Hint, StateChip } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierView } from "@/lib/seed";
import type { Draft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { legalApprove, legalSendBack } from "@/store/actions";
import { useDocketStore } from "@/store/useDocketStore";

export function LegalView({ views }: { views: SupplierView[] }) {
  const drafts = useDocketStore((s) => s.drafts);
  const requests = useDocketStore((s) => s.requests);
  const items = Object.values(drafts).filter((d) => requests[d.requestId]);
  const pending = items.filter((d) => requests[d.requestId].state === "legal_pending");
  const done = items.filter((d) => requests[d.requestId].state !== "legal_pending");
  const nameOf = (d: Draft) => views.find((v) => `REQ-${v.supplierId}` === d.requestId)?.name ?? d.requestId;
  return (
    <div className="space-y-8">
      {pending.length ? (
        pending.map((d) => <DraftCard key={d.requestId} d={d} name={nameOf(d)} />)
      ) : (
        <EmptyState icon={Scale} title="Nothing waiting on you" description="Exit notices and cap letters land here with deadline, method and address locked." />
      )}
      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Processed</h2>
          <div className="divide-y rounded-xl border bg-card shadow-soft">
            {done.map((d) => (
              <div key={d.requestId} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="text-base text-navy">{nameOf(d)} · {d.kind === "exit_notice" ? "Exit notice" : "Cap letter"}</span>
                <StateChip state={requests[d.requestId].state} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DraftCard({ d, name }: { d: Draft; name: string }) {
  const [back, setBack] = useState<string | null>(null);
  const g = d.guardrails;
  const ok = g.boundary.ok && g.numbers.ok;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      {/* The letter, document-style */}
      <article className="rounded-xl border bg-white px-10 py-9 shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
          <div>
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{d.kind === "exit_notice" ? "Notice of non-renewal" : "Cap enforcement"} · {name}</div>
            <h2 className="mt-1 text-xl font-semibold">{d.subject}</h2>
          </div>
          {d.source === "live" ? (
            <Badge variant="secondary" className="gap-1"><Sparkles className="size-3.5" /> Live AI wording</Badge>
          ) : (
            <Hint content={g.note ?? "Template fallback"}><Badge variant="outline">Template (cached)</Badge></Hint>
          )}
        </div>
        <div className="mt-5 max-w-[68ch] text-[1.0625rem] leading-8 whitespace-pre-wrap text-slate-800">{d.body}</div>
      </article>

      {/* Approval panel */}
      <aside data-tour="legal-draft" className="h-fit space-y-4 xl:sticky xl:top-24">
        <div className="rounded-xl border bg-card p-5 shadow-soft">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Locked by Rules</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.locked.map((l) => (
              <Hint key={l.key} content={`${l.label}: computed by Rules; the draft cannot change it`}>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm text-navy">
                  <Lock className="size-3.5 text-brand" /> <span className="font-semibold">{l.value}</span>
                </span>
              </Hint>
            ))}
          </div>
          <div className="mt-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">Guardrails</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Guard ok={g.boundary.ok} label="No negotiation" bad={g.boundary.violations} />
            <Guard ok={g.numbers.ok} label="Numbers match" bad={g.numbers.violations} />
          </div>
        </div>

        {back !== null ? (
          <div className="space-y-2 rounded-xl border bg-card p-4 shadow-soft">
            <Textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Reason for sending back" />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => legalSendBack(d.requestId, back)}><Undo2 /> Send back</Button>
              <Button variant="ghost" onClick={() => setBack(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => legalApprove(d.requestId)} disabled={!ok}><Send /> Approve &amp; mark sent</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" variant="outline" aria-label="More actions"><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setBack("")} className="gap-2"><Undo2 className="size-4" /> Send back to Procurement</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <Hint content="Docket never sends anything. Send it by the locked method, then mark it sent here.">
          <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Lock className="size-3" /> A human sends it, outside Docket</span>
        </Hint>
      </aside>
    </div>
  );
}

function Guard({ ok, label, bad }: { ok: boolean; label: string; bad: string[] }) {
  return (
    <Hint content={ok ? "Passed" : `Failed: ${bad.join(", ")}`}>
      <span className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-sm font-medium", ok ? "bg-lane-green-bg text-lane-green" : "bg-lane-red-bg text-lane-red")}>
        {ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />} {label}
      </span>
    </Hint>
  );
}
