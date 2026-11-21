"use client";

import { CheckCircle2, ExternalLink, FileQuestion, PencilLine, ScanLine, ScanSearch } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActorBadge, ConfidencePill, FlagChip, Hint, SourceChip } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_LABEL } from "@/lib/labels";
import type { UnmatchedDoc } from "@/lib/portfolio";
import type { ReviewField, SupplierView } from "@/lib/seed";
import { cn } from "@/lib/utils";
import { useDocketStore, type ReviewDecision } from "@/store/useDocketStore";

const show = (v: unknown) => (v === null || v === undefined ? "Not stated" : v === "unclear" ? "Unclear" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

/** Priya's human-review queue: AI fields that are unclear / low-confidence / OCR, and documents grouping could not place. */
export function ReviewQueue({ views, unmatched }: { views: SupplierView[]; unmatched: UnmatchedDoc[] }) {
  const reviews = useDocketStore((s) => s.reviews);
  const [open, setOpen] = useState<{ kind: "supplier"; v: SupplierView } | { kind: "doc"; u: UnmatchedDoc } | null>(null);
  const withFields = views.filter((v) => v.reviewFields.length || v.lane === "needs_review");
  const pending = (v: SupplierView) => v.reviewFields.filter((f) => !reviews[`field:${v.supplierId}:${f.key}`]).length;

  return (
    <Card className="rounded-xl shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-navy">
          <ScanSearch className="size-4 text-brand" /> Human review <ActorBadge actor="Human" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {withFields.map((v) => {
          const n = pending(v);
          const x1 = v.flags.find((f) => f.code === "X1");
          return (
            <button key={v.supplierId} onClick={() => setOpen({ kind: "supplier", v })} className="block w-full rounded-lg border p-2.5 text-left transition-colors hover:bg-surface">
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-navy">
                <span className="truncate">{v.name}</span>
                <span className={cn("text-xs tabular-nums", n ? "text-lane-review" : "text-lane-green")}>{n ? `${n} to check` : "done"}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {x1 && <FlagChip code="X1" detail={x1.detail} />}
                {v.pipeline?.ocrDocs.length ? <Badge variant="secondary" className="gap-1 text-[10px]"><ScanLine className="size-3" /> OCR</Badge> : null}
              </div>
            </button>
          );
        })}
        {unmatched.map((u) => {
          const d = reviews[`doc:${u.doc.doc_id}`];
          return (
            <button key={u.doc.doc_id} onClick={() => setOpen({ kind: "doc", u })} className="block w-full rounded-lg border border-dashed p-2.5 text-left transition-colors hover:bg-surface">
              <div className="flex items-center justify-between gap-1.5 text-sm font-medium text-navy">
                <span className="flex items-center gap-1.5"><FileQuestion className="size-4 text-lane-review" /> {u.doc.doc_id} · unmatched</span>
                {d && <CheckCircle2 className="size-3.5 text-lane-green" />}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{u.reason}</div>
              <div className="mt-1.5 flex gap-1.5"><SourceChip source={u.doc.source} /><ActorBadge actor="AI" /></div>
            </button>
          );
        })}
        {!withFields.length && !unmatched.length && <p className="text-xs text-muted-foreground">Nothing to review.</p>}
      </CardContent>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-[520px] overflow-y-auto sm:max-w-[520px]">
          {open?.kind === "supplier" && <SupplierReview v={open.v} />}
          {open?.kind === "doc" && <DocReview u={open.u} views={views} />}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function SupplierReview({ v }: { v: SupplierView }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>{v.name}</SheetTitle>
        <SheetDescription>
          {v.reviewFields.length} field{v.reviewFields.length === 1 ? "" : "s"} below 0.85 confidence or unclear.{" "}
          <Link href={`/contracts/${v.supplierId}`} className="text-brand underline-offset-2 hover:underline">Open contract file</Link>
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-3 px-4 pb-6">
        {v.reviewFields.map((f) => <FieldItem key={f.key} supplierId={v.supplierId} f={f} />)}
      </div>
    </>
  );
}

function FieldItem({ supplierId, f }: { supplierId: string; f: ReviewField }) {
  const id = `field:${supplierId}:${f.key}`;
  const done = useDocketStore((s) => s.reviews[id]);
  const record = useDocketStore((s) => s.recordReview);
  const [fix, setFix] = useState<string | null>(null);
  const label = FIELD_LABEL[f.key] ?? f.key;
  const decide = (action: ReviewDecision["action"], value?: string) => record({ itemId: id, kind: "field", action, value, by: "procurement" }, `REQ-${supplierId}`, `${label} (${supplierId})`);
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground uppercase">{label}</span>
        <span className="flex items-center gap-1.5">
          {f.ocr && <Badge variant="secondary" className="gap-1 text-[10px]"><ScanLine className="size-3" /> OCR</Badge>}
          <ConfidencePill value={f.confidence} unclear={f.value === "unclear"} />
        </span>
      </div>
      <div className="mt-1 text-sm font-semibold text-navy">{show(f.value)}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{f.reason}{f.note ? ` · ${f.note}` : ""}</div>
      {f.citation && (
        <>
          <blockquote className="mt-2 rounded-md border-l-4 border-brand bg-surface p-2 text-xs text-navy italic">“{f.citation.quote}”</blockquote>
          <a href={`/api/docs/${f.citation.doc_id}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-brand">
            {f.citation.doc_id} §{f.citation.section} <ExternalLink className="size-3" />
          </a>
        </>
      )}
      {done ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-lane-green">
          <CheckCircle2 className="size-3.5" /> {done.action === "confirmed" ? "Confirmed" : `Corrected to “${done.value}”`} · logged
        </div>
      ) : fix !== null ? (
        <div className="mt-2 space-y-2">
          <Textarea value={fix} onChange={(e) => setFix(e.target.value)} placeholder="Correct value, as written in the contract" className="min-h-14" />
          <div className="flex gap-2">
            <Button size="sm" disabled={!fix.trim()} onClick={() => decide("corrected", fix.trim())}>Save correction</Button>
            <Button size="sm" variant="ghost" onClick={() => setFix(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => decide("confirmed")}><CheckCircle2 /> Confirm</Button>
          <Button size="sm" variant="outline" onClick={() => setFix("")}><PencilLine /> Correct</Button>
        </div>
      )}
    </div>
  );
}

function DocReview({ u, views }: { u: UnmatchedDoc; views: SupplierView[] }) {
  const id = `doc:${u.doc.doc_id}`;
  const done = useDocketStore((s) => s.reviews[id]);
  const record = useDocketStore((s) => s.recordReview);
  const [assign, setAssign] = useState<string>("");
  return (
    <>
      <SheetHeader>
        <SheetTitle>{u.doc.doc_id} · not matched to a supplier</SheetTitle>
        <SheetDescription>{u.reason}</SheetDescription>
      </SheetHeader>
      <div className="space-y-3 px-4 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <SourceChip source={u.doc.source} detail={u.doc.source_path} /> received {u.doc.received_date}
          {u.confidence != null && <ConfidencePill value={u.confidence} />}
        </div>
        {u.evidence.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-navy">
            {u.evidence.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <Button asChild variant="outline" size="sm">
          <a href={`/api/docs/${u.doc.doc_id}`} target="_blank" rel="noreferrer"><ExternalLink /> Open {u.doc.doc_id} (PDF)</a>
        </Button>
        {done ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-lane-green">
            <CheckCircle2 className="size-3.5" /> {done.action === "confirmed" ? "Confirmed: not part of any tracked supplier" : `Assigned to ${done.value}`} · logged
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border p-3">
            <Hint content="Grouping never uses file names or folders. A wrong assignment is worse than a review.">
              <span className="text-xs font-medium text-navy">Decision</span>
            </Hint>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => record({ itemId: id, kind: "document", action: "confirmed", by: "procurement" }, null, `${u.doc.doc_id} is not a tracked supplier's document`)}>
              <CheckCircle2 /> Confirm: not ours to track
            </Button>
            <div className="flex gap-2">
              <select value={assign} onChange={(e) => setAssign(e.target.value)} className="h-8 flex-1 rounded-md border bg-background px-2 text-xs">
                <option value="">Assign to supplier…</option>
                {views.map((v) => <option key={v.supplierId} value={v.supplierId}>{v.name}</option>)}
              </select>
              <Button size="sm" disabled={!assign} onClick={() => record({ itemId: id, kind: "document", action: "corrected", value: assign, by: "procurement" }, `REQ-${assign}`, `grouping of ${u.doc.doc_id}`)}>
                <PencilLine /> Assign
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
