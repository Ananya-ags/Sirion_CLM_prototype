"use client";

import { AlertTriangle, CheckCircle2, Lock, Scale, Send, Undo2 } from "lucide-react";
import { useState } from "react";
import { ActorBadge, EmptyState, Hint } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { SupplierView } from "@/lib/seed";
import type { Draft } from "@/lib/types";
import { legalApprove, legalSendBack } from "@/store/actions";
import { useDocketStore } from "@/store/useDocketStore";
import { StateChip } from "@/components/docket";

export function LegalView({ views }: { views: SupplierView[] }) {
  const drafts = useDocketStore((s) => s.drafts);
  const requests = useDocketStore((s) => s.requests);
  const items = Object.values(drafts).filter((d) => requests[d.requestId]);
  const pending = items.filter((d) => requests[d.requestId].state === "legal_pending");
  const done = items.filter((d) => requests[d.requestId].state !== "legal_pending");
  if (!items.length) return <EmptyState icon={Scale} title="No drafts awaiting approval" description="When Procurement drafts an exit notice or cap letter, it lands here with its deadline, method and address locked." />;
  return (
    <div className="space-y-4">
      {pending.map((d) => <DraftCard key={d.requestId} d={d} name={views.find((v) => `REQ-${v.supplierId}` === d.requestId)?.name ?? d.requestId} />)}
      {done.length > 0 && (
        <Card className="rounded-xl shadow-soft">
          <CardHeader><CardTitle className="text-sm text-navy">Processed</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {done.map((d) => (
              <div key={d.requestId} className="flex items-center justify-between text-sm">
                <span className="text-navy">{d.subject}</span>
                <StateChip state={requests[d.requestId].state} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DraftCard({ d, name }: { d: Draft; name: string }) {
  const [back, setBack] = useState<string | null>(null);
  const g = d.guardrails;
  return (
    <Card className="rounded-xl shadow-soft">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-navy">
          <span>{d.subject}</span>
          <span className="flex items-center gap-1.5">
            {d.source === "live" ? <ActorBadge actor="AI" /> : <Hint content={g.note ?? "Template fallback"}><Badge variant="secondary">cached</Badge></Hint>}
            <ActorBadge actor="legal" />
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{name} · {d.kind === "exit_notice" ? "Notice of non-renewal" : "Cap enforcement"}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {d.locked.map((l) => (
            <Hint key={l.key} content="Locked: computed by Rules, the draft cannot change it">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs text-navy">
                <Lock className="size-3 text-brand" /> <span className="text-muted-foreground">{l.label}</span> <span className="font-semibold">{l.value}</span>
              </span>
            </Hint>
          ))}
        </div>
        <pre className="max-h-80 overflow-auto rounded-lg border bg-white p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-navy">{d.body}</pre>
        <div className="flex flex-wrap items-center gap-2">
          <Guard ok={g.boundary.ok} label="Boundary check" bad={g.boundary.violations} />
          <Guard ok={g.numbers.ok} label="Numbers match" bad={g.numbers.violations} />
          {g.note && <span className="text-[11px] text-muted-foreground">{g.note}</span>}
        </div>
        {back !== null ? (
          <div className="space-y-2">
            <Textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Reason for sending back" />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => legalSendBack(d.requestId, back)}><Undo2 /> Send back</Button>
              <Button variant="ghost" onClick={() => setBack(null)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={() => legalApprove(d.requestId)} disabled={!g.boundary.ok || !g.numbers.ok}><Send /> Approve &amp; mark sent</Button>
            <Button variant="outline" onClick={() => setBack("")}><Undo2 /> Send back</Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">Docket never sends anything. You send it by the locked method, then mark it sent here.</p>
      </CardContent>
    </Card>
  );
}

function Guard({ ok, label, bad }: { ok: boolean; label: string; bad: string[] }) {
  return (
    <Hint content={ok ? "Passed" : `Failed: ${bad.join(", ")}`}>
      <span className={ok ? "inline-flex h-6 items-center gap-1 rounded-full bg-lane-green-bg px-2.5 text-xs font-medium text-lane-green" : "inline-flex h-6 items-center gap-1 rounded-full bg-lane-red-bg px-2.5 text-xs font-medium text-lane-red"}>
        {ok ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />} {label} {ok ? "✓" : "!"}
      </span>
    </Hint>
  );
}
