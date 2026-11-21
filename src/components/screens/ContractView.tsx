"use client";

import { ArrowLeft, BadgeCheck, CalendarClock, CheckCircle2, ExternalLink, FileSignature, FileText, Handshake, Loader2, Mail, Paperclip, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActorBadge, ConfidencePill, FlagChip, Hint, LaneBadge, MiniBars, SourceChip, StateChip } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatINR, formatINRShort } from "@/lib/format";
import { CATEGORY_LABEL, FIELD_LABEL, ROLE_LABEL, TERMINAL } from "@/lib/labels";
import type { FamilyDoc, SupplierView } from "@/lib/seed";
import type { Field, Flag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { approveRenewal, draftNotice, handOffRenegotiation } from "@/store/actions";
import { useDocketStore } from "@/store/useDocketStore";
import { useRequestMap } from "./useRequest";

type Leaf = { key: string; field: Field<unknown> };

const fmtValue = (key: string, v: unknown, currency: string) => {
  if (v === null || v === undefined) return "—";
  if (v === "unclear") return "Unclear";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key === "annual_value" && typeof v === "number") return currency === "INR" ? formatINR(v) : `${currency} ${v.toLocaleString("en-IN")}`;
  if (key.endsWith("_pct")) return `${v}%`;
  if (key === "notice_days" || key === "tfc_notice_days" || key === "payment_terms_days") return `${v} days`;
  if (key === "renewal_term_months") return `${v} months`;
  if (key === "initial_term_end" && typeof v === "string") return formatDate(v);
  return String(v).replace(/_/g, " ");
};

export function ContractView({ view }: { view: SupplierView }) {
  const req = useRequestMap([view])[view.supplierId];
  const audit = useDocketStore((s) => s.audit).filter((a) => a.requestId === req.id).slice().reverse();
  const confirmations = Object.values(useDocketStore((s) => s.financeConfirmations)).filter((c) => c.requestId === req.id);
  const draft = useDocketStore((s) => s.drafts[req.id]);
  const [open, setOpen] = useState<Leaf | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const leaves: Leaf[] = Object.entries(view.terms).flatMap(([k, f]) =>
    k === "uplift" ? Object.entries(f as Record<string, Field<unknown>>).map(([kk, ff]) => ({ key: `uplift.${kk}`, field: ff })) : [{ key: k, field: f as Field<unknown> }],
  );
  const docOf = (id?: string) => view.family.find((d) => d.doc_id === id);
  const days = view.actBy?.daysToActBy;
  const hasF3 = view.flags.some((f) => f.code === "F3");
  const actionable = !TERMINAL.includes(req.state) && req.state !== "legal_pending";
  const ledgerFlags = view.flags.filter((f) => f.code.startsWith("L"));
  const run = async (key: string, fn: () => unknown) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-5 shadow-soft">
        <div>
          <Link href="/inbox" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
            <ArrowLeft className="size-3" /> Inbox
          </Link>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{view.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <LaneBadge lane={view.lane} />
            <StateChip state={req.state} />
            <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[view.category]} · {view.vendorId}</span>
            <Hint content="Extraction was pre-computed and checked by a human against the gold set. Live extraction ships with AI grouping and PDF parsing.">
              <Badge variant="secondary" className="gap-1"><BadgeCheck className="size-3" /> Pre-computed · human-verified</Badge>
            </Hint>
          </div>
        </div>
        <div className="flex gap-3">
          <div className={cn("rounded-xl px-4 py-3 text-center", days != null && days <= 14 ? "bg-lane-red-bg text-lane-red" : "bg-surface-2 text-brand-strong")}>
            <div className="flex items-center justify-center gap-1 text-[11px] font-medium"><CalendarClock className="size-3" /> Act-by</div>
            <div className="text-2xl font-semibold tabular-nums">{days != null ? `${days}d` : "—"}</div>
            <div className="text-[11px]">{view.actBy ? formatDate(view.actBy.actBy) : view.money.earliestExit ? `Exit ${formatDate(view.money.earliestExit)}` : "No deadline"}</div>
          </div>
          <div className="rounded-xl bg-surface px-4 py-3 text-center text-navy">
            <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"><Target className="size-3" /> Internal target</div>
            <div className="text-sm font-semibold">{view.actBy ? formatDate(view.actBy.decisionTarget) : "—"}</div>
            {view.actBy?.decisionTargetPassed && <div className="text-[11px] font-medium text-lane-amber">passed</div>}
          </div>
          <div className="rounded-xl bg-surface px-4 py-3 text-center text-navy">
            <div className="text-[11px] font-medium text-muted-foreground">Annual value</div>
            <div className="text-sm font-semibold">{formatINRShort(view.money.annualInr)}</div>
            {view.money.currency !== "INR" && <div className="text-[11px] text-muted-foreground">{view.money.currency} @ ₹84</div>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Family */}
          <Section title="Contract family" actors={["AI", "Human"]} hint="Documents grouped by legal identifiers (CIN/GSTIN/envelope ID/cross-references), never folder or filename. Latest executed amendment wins per field.">
            <div className="space-y-2">
              {view.family.map((d) => (
                <FamilyRow key={d.doc_id} d={d} />
              ))}
            </div>
          </Section>

          {/* Terms */}
          <Section title="Effective terms" actors={["AI", "Rules"]} hint="Every value carries a verbatim citation. Click a field for the quote and source PDF.">
            <div className="grid gap-2 sm:grid-cols-2">
              {leaves.map((l) => {
                const d = docOf(l.field.overridden_by ?? l.field.citation?.doc_id);
                return (
                  <button key={l.key} onClick={() => setOpen(l)} className="group rounded-lg border p-3 text-left transition-colors hover:border-brand/40 hover:bg-surface">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase">{FIELD_LABEL[l.key] ?? l.key}</span>
                      <ConfidencePill value={l.field.confidence} unclear={l.field.value === "unclear"} />
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-navy">{fmtValue(l.key.split(".").pop()!, l.field.value, view.money.currency)}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {d?.meta && <SourceChip source={d.meta.source} detail={`${d.doc_id} · ${d.meta.filename}`} />}
                      {l.field.citation && <span className="text-[11px] text-muted-foreground">{l.field.citation.doc_id} §{l.field.citation.section}</span>}
                      {l.field.overridden_by && <span className="text-[11px] font-medium text-src-docusign">overridden by {l.field.overridden_by}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Tracker */}
          <Section title="Tracker vs contract" actors={["Rules"]} hint="T1: the Excel tracker compared field by field against the effective terms.">
            {view.trackerRow ? (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Field</TableHead><TableHead><SourceChip source="tracker" /></TableHead><TableHead>Contract</TableHead><TableHead /></TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["end_date", "End date", view.trackerRow.end_date, String(view.terms.initial_term_end.value)],
                    ["auto_renew", "Auto-renew", view.trackerRow.auto_renew, String(view.terms.renewal_type.value)],
                    ["notice_days", "Notice days", String(view.trackerRow.notice_days ?? "—"), String(view.terms.notice_days.value ?? "—")],
                    ["annual_value_inr", "Annual value", formatINRShort(view.trackerRow.annual_value_inr ?? 0), formatINRShort(view.money.annualInr)],
                    ["status", "Status", view.trackerRow.status, view.trackerConflicts.find((c) => c.field === "status")?.contract_value ?? view.trackerRow.status],
                  ].map(([key, label, t, c]) => {
                    const conflict = view.trackerConflicts.find((x) => x.field === key);
                    return (
                      <TableRow key={key} className={cn(conflict && "bg-lane-amber-bg/60")}>
                        <TableCell className="text-muted-foreground">{label}</TableCell>
                        <TableCell className={cn(conflict && "text-lane-amber line-through")}>{t}</TableCell>
                        <TableCell className="font-medium text-navy">{String(c)}</TableCell>
                        <TableCell>{conflict && <FlagChip code="T1" detail={`Source: ${conflict.source}`} />}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center gap-2 rounded-lg bg-lane-red-bg px-3 py-2.5 text-sm text-lane-red">
                <FlagChip code="T1" detail="Contract exists but there is no tracker row." /> Missing from the tracker entirely.
              </div>
            )}
          </Section>

          {/* Billing */}
          <Section title="Billing vs contract" actors={["Rules"]} hint="Ledger (pre-tax, by service period) against the contracted monthly value. Vendor matched by name for now; AI entity match later.">
            <div className="grid gap-4 md:grid-cols-[1fr_240px]">
              <MiniBars months={view.ledgerMonths} contracted={view.lane === "needs_review" || view.money.annualInr ? view.money.monthlyInr : 0} />
              <div className="space-y-2">
                <div className="flex items-center gap-2"><SourceChip source="ledger" /><span className="text-xs text-muted-foreground">{view.ledgerSummary.invoices} invoices · {formatINRShort(view.ledgerSummary.total_pre_tax_inr)}</span></div>
                {ledgerFlags.length ? ledgerFlags.map((f) => <FlagLine key={f.code} f={f} />) : <p className="text-xs text-muted-foreground">No billing anomalies.</p>}
              </div>
            </div>
          </Section>

          {/* Audit */}
          <Section title="Audit trail" actors={["AI", "Rules", "Human"]}>
            {audit.length ? (
              <ol className="space-y-2">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <ActorBadge actor={a.actor} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-navy">{a.action}</div>
                      <div className="text-xs text-muted-foreground">{a.reason}</div>
                    </div>
                    <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">{a.ts.slice(11, 16)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">No activity yet.</p>
            )}
          </Section>
        </div>

        {/* Decision card */}
        <div>
          <Card className="sticky top-20 rounded-xl border-brand/20 shadow-lift">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-navy">
                Decision card <ActorBadge actor="procurement" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-surface p-3">
                <LaneBadge lane={view.lane} />
                <p className="mt-2 text-xs text-muted-foreground">{view.laneReason}</p>
              </div>
              {req.owner_decision && (
                <div className="rounded-lg border p-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-navy"><ActorBadge actor="owner" /> chose {req.owner_decision.choice === "procurement" ? "Send to Procurement" : req.owner_decision.choice}</div>
                  <div className="mt-1 text-muted-foreground">{req.owner_decision.reason}</div>
                </div>
              )}
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-muted-foreground uppercase">Flags</div>
                {view.flags.map((f) => <FlagLine key={f.code} f={f} />)}
              </div>
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-muted-foreground uppercase">Evidence pack</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set(view.flags.flatMap((f) => f.evidence ?? []).map((c) => c.doc_id))].map((id) => (
                    <a key={id} href={`/api/docs/${id}`} target="_blank" rel="noreferrer" className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs text-navy hover:bg-surface">
                      <Paperclip className="size-3" /> {id}
                    </a>
                  ))}
                  {confirmations.map((c) => (
                    <Hint key={c.alertId} content={c.note ?? "Confirmed by Finance"}>
                      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-lane-green-bg px-2 text-xs font-medium text-lane-green">
                        <CheckCircle2 className="size-3" /> Finance confirmed {c.flagCode}
                      </span>
                    </Hint>
                  ))}
                  {!confirmations.length && ledgerFlags.length > 0 && <span className="text-xs text-muted-foreground">Awaiting Finance confirmation</span>}
                </div>
              </div>
              {draft && (
                <div className="rounded-lg border p-3 text-xs">
                  <div className="flex items-center gap-2 font-medium text-navy"><Mail className="size-3.5" /> {draft.subject}</div>
                  <div className="mt-1 text-muted-foreground">{draft.source === "live" ? "Live draft" : "Template (cached)"} · with Legal</div>
                </div>
              )}
              <div className="grid gap-2 pt-1">
                <Button disabled={!actionable || !!busy} onClick={() => approveRenewal(req.id)}>
                  <ShieldCheck /> Approve renewal
                </Button>
                <Button variant="secondary" disabled={!actionable || !!busy || !view.actBy && !view.money.earliestExit} onClick={() => run("exit", () => draftNotice(req.id, "exit_notice"))}>
                  {busy === "exit" ? <Loader2 className="animate-spin" /> : <FileSignature />} Draft exit notice <ActorBadge actor="AI" />
                </Button>
                {hasF3 && (
                  <Button variant="secondary" disabled={!actionable || !!busy} onClick={() => run("cap", () => draftNotice(req.id, "cap_letter"))}>
                    {busy === "cap" ? <Loader2 className="animate-spin" /> : <FileText />} Draft cap-enforcement letter <ActorBadge actor="AI" />
                  </Button>
                )}
                <Button variant="outline" disabled={!actionable || !!busy} onClick={() => handOffRenegotiation(req.id)}>
                  <Handshake /> Hand off for renegotiation
                  <Badge variant="outline" className="ml-1 text-[10px]">Out of scope</Badge>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Docket never negotiates. Drafts only use rights already in the contract; Legal approves and a human sends.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-[440px] sm:max-w-[440px]">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{FIELD_LABEL[open.key] ?? open.key}</SheetTitle>
                <SheetDescription>{fmtValue(open.key.split(".").pop()!, open.field.value, view.money.currency)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="flex flex-wrap gap-2">
                  <ConfidencePill value={open.field.confidence} unclear={open.field.value === "unclear"} />
                  <ActorBadge actor="AI" />
                  <Badge variant="secondary" className="gap-1"><BadgeCheck className="size-3" /> Pre-computed · human-verified</Badge>
                </div>
                {open.field.citation ? (
                  <>
                    <blockquote className="rounded-lg border-l-4 border-brand bg-surface p-3 text-sm text-navy italic">“{open.field.citation.quote}”</blockquote>
                    <div className="text-xs text-muted-foreground">
                      {open.field.citation.doc_id} · §{open.field.citation.section}
                      {docOf(open.field.citation.doc_id)?.meta && ` · ${docOf(open.field.citation.doc_id)!.meta!.filename}`}
                    </div>
                    {open.field.overridden_by && <p className="text-xs font-medium text-src-docusign">Overridden by {open.field.overridden_by} (latest executed amendment wins).</p>}
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/docs/${open.field.citation.doc_id}`} target="_blank" rel="noreferrer"><ExternalLink /> Open {open.field.citation.doc_id} (PDF)</a>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No citation. The value is not stated in the contract, so it is not used.</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Section({ title, actors, hint, children }: { title: string; actors: ("AI" | "Rules" | "Human")[]; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-xl shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-navy">
          <Hint content={hint}><span>{title}</span></Hint>
          <span className="flex gap-1">{actors.map((a) => <ActorBadge key={a} actor={a} />)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function FamilyRow({ d }: { d: FamilyDoc }) {
  const indent = d.doc_role === "msa" ? 0 : d.doc_role === "sow" || d.doc_role === "order_form" ? 1 : 2;
  const executed = d.executed === true ? "Executed" : d.executed === false ? "Draft / unsigned" : "Unknown";
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-2.5", d.governs.length && "border-brand/30 bg-surface/60")} style={{ marginLeft: indent * 20 }}>
      <span className="w-20 shrink-0 text-xs font-semibold text-navy">{ROLE_LABEL[d.doc_role]}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-navy">{d.meta?.filename ?? d.doc_id}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {d.meta && <SourceChip source={d.meta.source} detail={d.meta.source_path} />}
          <Hint content={d.execution_evidence.join(" · ") || "No execution evidence"}>
            <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium", d.executed === true ? "bg-lane-green-bg text-lane-green" : "bg-lane-review-bg text-lane-review")}>
              {d.executed === true ? <CheckCircle2 className="size-3" /> : null} {executed}
            </span>
          </Hint>
          {d.grouping_evidence.length > 0 && (
            <Hint content={d.grouping_evidence.join(" · ")}>
              <span className="text-[11px] text-muted-foreground underline decoration-dotted">why grouped</span>
            </Hint>
          )}
        </div>
      </div>
      {d.governs.length > 0 && (
        <Hint content={`Supplies: ${d.governs.map((g) => FIELD_LABEL[g] ?? g).join(", ")}`}>
          <Badge className="shrink-0">Wins · {d.governs.length}</Badge>
        </Hint>
      )}
      <a href={`/api/docs/${d.doc_id}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-brand" aria-label={`Open ${d.doc_id}`}>
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

function FlagLine({ f }: { f: Flag }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <FlagChip code={f.code} detail={f.detail} />
      {f.impactInr ? <span className="text-sm font-semibold text-navy tabular-nums">{formatINRShort(f.impactInr)}</span> : <span className="truncate text-[11px] text-muted-foreground">{f.detail}</span>}
    </div>
  );
}
