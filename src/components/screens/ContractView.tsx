"use client";

import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileSignature,
  FileText,
  Handshake,
  Hourglass,
  Info,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Paperclip,
  ScanLine,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ActorBadge, ConfidencePill, FlagChip, Hint, LaneBadge, MiniBars, SourceChip, StateChip } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { displayRole, isTopLevel } from "@/lib/family";
import { formatDate, formatINR, formatINRShort } from "@/lib/format";
import { CATEGORY_LABEL, FIELD_LABEL, lakh1, metricLabel, monthLabel, monthList, STATE_LABEL } from "@/lib/labels";
import { PROCUREMENT_ACTIONABLE } from "@/lib/requestFlow";
import type { FamilyDoc, SupplierView } from "@/lib/seed";
import type { Field, Flag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { approveRenewal, confirmReview, draftNotice, handOffRenegotiation } from "@/store/actions";
import { useDocketStore } from "@/store/useDocketStore";
import { useLiveViews } from "./useLiveViews";
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

type Action = { id: string; label: string; icon: typeof ShieldCheck; run: () => unknown; ai?: boolean; outOfScope?: boolean };

export function ContractView({ view: serverView }: { view: SupplierView }) {
  const view = useLiveViews([serverView])[0];
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
  const canExit = !!(view.actBy || view.money.earliestExit);
  const actionable = PROCUREMENT_ACTIONABLE.includes(req.state);
  const s1 = view.flags.find((f) => f.code === "S1");
  const u1 = view.flags.find((f) => f.code === "U1");
  const ledgerFlags = view.flags.filter((f) => f.code.startsWith("L"));
  const run = async (key: string, fn: () => unknown) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  // One primary action, chosen from the owner's decision; the rest go in the "…" menu.
  const all: Action[] = [
    ...(canExit ? [{ id: "exit", label: "Draft exit notice", icon: FileSignature, ai: true, run: () => run("exit", () => draftNotice(req.id, "exit_notice")) }] : []),
    ...(hasF3 ? [{ id: "cap", label: "Draft cap-enforcement letter", icon: FileText, ai: true, run: () => run("cap", () => draftNotice(req.id, "cap_letter")) }] : []),
    { id: "renew", label: "Approve renewal", icon: ShieldCheck, run: () => approveRenewal(req.id) },
    { id: "handoff", label: "Hand off for renegotiation", icon: Handshake, outOfScope: true, run: () => handOffRenegotiation(req.id) },
  ];
  const choice = req.owner_decision?.choice;
  const primaryId = choice === "renew" ? "renew" : choice === "procurement" && hasF3 ? "cap" : canExit ? "exit" : hasF3 ? "cap" : "renew";
  const primary = all.find((a) => a.id === primaryId) ?? all[0];
  const secondary = all.filter((a) => a !== primary);
  const waitingLabel = req.state === "owner_pending" ? "Waiting on the budget owner" : req.state === "human_review" ? "Confirm the review first" : req.state === "legal_pending" ? "With Legal" : STATE_LABEL[req.state];
  const PrimaryIcon = primary.icon;
  const conflicts = view.trackerConflicts.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div data-tour="contract-header" className="flex flex-wrap items-start justify-between gap-6 rounded-xl border bg-card p-6 shadow-soft">
        <div className="min-w-0">
          <Link href="/inbox" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand">
            <ArrowLeft className="size-4" /> Inbox
          </Link>
          <h2 className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight">{view.name}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LaneBadge lane={view.lane} />
            <StateChip state={req.state} />
            <span className="text-sm text-slate-600">{CATEGORY_LABEL[view.category]}</span>
            <ExtractionBadge view={view} />
          </div>
        </div>
        <div className="flex gap-3">
          <Stat
            tone={days != null && days <= 14 ? "red" : "brand"}
            icon={CalendarClock}
            label="Act-by"
            value={days != null ? `${days} days` : view.money.earliestExit ? "Rolling" : "—"}
            caption={view.actBy ? formatDate(view.actBy.actBy) : view.money.earliestExit ? `exit ${formatDate(view.money.earliestExit)}` : "no deadline"}
          />
          <Stat icon={Target} label="Internal target" value={view.actBy ? formatDate(view.actBy.decisionTarget) : "—"} caption={view.actBy?.decisionTargetPassed ? "passed" : "act-by − 15 days"} warn={view.actBy?.decisionTargetPassed} />
          <Stat label="Annual value" value={formatINRShort(view.money.annualInr)} caption={view.money.currency !== "INR" ? `${view.money.currency} @ ₹84` : "per year"} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Tabs defaultValue="terms" className="min-w-0">
          <TabsList className="mb-2">
            <TabsTrigger value="terms">Terms</TabsTrigger>
            <TabsTrigger value="docs">Documents & drafts</TabsTrigger>
            <TabsTrigger value="billing">Billing & performance</TabsTrigger>
            <TabsTrigger value="audit">Audit trail</TabsTrigger>
          </TabsList>

          {/* Terms */}
          <TabsContent value="terms" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leaves.map((l) => {
                const d = docOf(l.field.overridden_by ?? l.field.citation?.doc_id);
                const flagged = l.field.value === "unclear" || (l.field.ocr && l.field.source !== "human") || l.field.verified === false;
                return (
                  <button
                    key={l.key}
                    data-tour={`term-${l.key}`}
                    onClick={() => setOpen(l)}
                    className={cn("rounded-xl border bg-card p-4 text-left shadow-soft transition-colors hover:border-brand/40 hover:bg-surface", flagged && "border-lane-review/40")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{FIELD_LABEL[l.key] ?? l.key}</span>
                      {l.field.source === "human" ? <HumanChip note={l.field.note} /> : l.field.ocr ? <OcrChip /> : l.field.value === "unclear" ? <ConfidencePill value={l.field.confidence} unclear /> : null}
                    </div>
                    <div className="mt-1.5 truncate text-base font-semibold text-navy">{fmtValue(l.key.split(".").pop()!, l.field.value, view.money.currency)}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">
                      {l.field.citation ? `${l.field.citation.doc_id} §${l.field.citation.section}${l.field.via ? ` via ${l.field.via.section}` : ""}` : "not stated"}
                      {d?.meta ? ` · ${d.meta.source === "docusign" ? "DocuSign" : d.meta.source === "sharepoint" ? "SharePoint" : "Email"}` : ""}
                      {l.field.overridden_by ? " · amended" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
            <details className="rounded-xl border bg-card shadow-soft" open={conflicts > 0 || !view.trackerRow}>
              <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-2 text-base font-semibold text-navy"><SourceChip source="tracker" /> Tracker vs contract</span>
                <span className={cn("text-sm font-medium", conflicts || !view.trackerRow ? "text-lane-amber" : "text-lane-green")}>{!view.trackerRow ? "Missing from tracker" : conflicts ? `${conflicts} conflict${conflicts > 1 ? "s" : ""}` : "Matches"}</span>
              </summary>
              <div className="px-5 pb-4">
                {view.trackerRow ? (
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"><th className="py-2">Field</th><th>Tracker says</th><th>Contract says</th></tr></thead>
                    <tbody>
                      {[
                        ["end_date", "End date", view.trackerRow.end_date, view.terms.initial_term_end.value ? String(view.terms.initial_term_end.value) : "—"],
                        ["auto_renew", "Auto-renew", view.trackerRow.auto_renew, String(view.terms.renewal_type.value)],
                        ["notice_days", "Notice days", String(view.trackerRow.notice_days ?? "—"), String(view.terms.notice_days.value ?? "—")],
                        ["annual_value_inr", "Annual value", formatINRShort(view.trackerRow.annual_value_inr ?? 0), formatINRShort(view.money.annualInr)],
                        ["status", "Status", view.trackerRow.status, view.trackerConflicts.find((c) => c.field === "status")?.contract_value ?? view.trackerRow.status],
                      ].map(([key, label, t, c]) => {
                        const conflict = view.trackerConflicts.find((x) => x.field === key);
                        return (
                          <tr key={key} className={cn("border-t", conflict && "bg-lane-amber-bg/60")}>
                            <td className="py-2 text-slate-600">{label}</td>
                            <td className={cn(conflict && "text-lane-amber line-through")}>{t}</td>
                            <td className="font-medium text-navy">
                              {String(c)} {conflict && <Hint content={`Source: ${conflict.source}`}><Info className="ml-1 inline size-3.5 text-lane-amber" /></Hint>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-lane-red">The contract exists but there is no tracker row.</p>
                )}
              </div>
            </details>
          </TabsContent>

          {/* Documents & drafts */}
          <TabsContent value="docs" className="space-y-4">
            <Panel title="Contract family" actors={["AI", "Human"]} hint="Grouped by legal identifiers (CIN/GSTIN/envelope ID/cross-references), never folder or filename. The latest executed amendment wins per field.">
              <div className="space-y-2">
                {view.family.map((d) => <FamilyRow key={d.doc_id} d={d} family={view.family} />)}
              </div>
            </Panel>
            {view.proposed.length > 0 ? (
              <Panel title="Draft / redline (non-binding)" hint="Terms stated in documents that are not executed. Shown for comparison; only executed documents feed the rules.">
                <div className="space-y-4">
                  {view.proposed.map((p) => (
                    <div key={p.docId}>
                      <div className="mb-1.5 text-sm font-medium text-navy">{p.docId} · {p.fields.filter((f) => f.differs).length} differ from the signed terms</div>
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"><th className="py-2">Field</th><th>Draft says</th><th>Signed</th></tr></thead>
                        <tbody>
                          {p.fields.map((f) => (
                            <tr key={f.key} className={cn("border-t", f.differs && "bg-lane-amber-bg/60")}>
                              <td className="py-2 text-slate-600">{FIELD_LABEL[f.key] ?? f.key}</td>
                              <td className={cn("font-medium", f.differs ? "text-lane-amber" : "text-navy")}>
                                <Hint content={f.citation ? `${f.citation.doc_id} §${f.citation.section}: “${f.citation.quote}”` : undefined}>
                                  <span>{fmtValue(f.key.split(".").pop()!, f.value, view.money.currency)}</span>
                                </Hint>
                              </td>
                              <td className="text-navy">{fmtValue(f.key.split(".").pop()!, f.effective, view.money.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </Panel>
            ) : (
              <p className="px-1 text-sm text-slate-500">No drafts or redlines in this family.</p>
            )}
          </TabsContent>

          {/* Billing & performance */}
          <TabsContent value="billing" className="space-y-4">
            <Panel title="Billing vs contract" actors={["Rules"]} hint="Ledger (pre-tax, by service period) against the contracted monthly value.">
              <div className="grid gap-5 md:grid-cols-[1fr_260px]">
                <MiniBars months={view.ledgerMonths} contracted={view.money.monthlyInr} />
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <SourceChip source="ledger" /> {view.ledgerSummary.invoices} invoices · {formatINRShort(view.ledgerSummary.total_pre_tax_inr)}
                  </div>
                  {ledgerFlags.length ? ledgerFlags.map((f) => <FlagLine key={f.code} f={f} />) : <p className="text-sm text-lane-green">No billing issues.</p>}
                </div>
              </div>
            </Panel>
            {(view.sla || view.utilisation) && (
              <div className="grid gap-4 md:grid-cols-2">
                {view.sla && view.sla.monthsReported > 0 && <PerformanceCard view={view} />}
                {view.utilisation && <UtilisationCard view={view} />}
              </div>
            )}
          </TabsContent>

          {/* Audit */}
          <TabsContent value="audit">
            <Panel title="Audit trail" actors={["AI", "Rules", "Human"]}>
              {audit.length ? (
                <ol className="max-h-[480px] space-y-3 overflow-auto">
                  {audit.map((a) => (
                    <li key={a.id} className="flex items-start gap-3">
                      <ActorBadge actor={a.actor} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-navy">{a.action}</div>
                        <div className="text-xs text-slate-500">{a.reason}</div>
                      </div>
                      <span className="text-xs whitespace-nowrap text-slate-400 tabular-nums">{a.ts.slice(11, 16)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">No activity yet.</p>
              )}
            </Panel>
          </TabsContent>
        </Tabs>

        {/* Decision card */}
        <div>
          <div data-tour="decision" className="sticky top-24 space-y-4 rounded-xl border-2 border-brand/15 bg-card p-5 shadow-lift">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Decision card</h3>
              <ActorBadge actor="procurement" />
            </div>
            <Hint content={view.laneReason} className="flex w-full min-w-0">
              <div className="flex w-full min-w-0 items-center gap-2 rounded-lg bg-surface p-3">
                <LaneBadge lane={view.lane} />
                <span className="truncate text-sm text-slate-600">{view.laneReason.split(":")[1]?.split(".")[0]?.trim() || view.laneReason}</span>
              </div>
            </Hint>

            {req.state === "owner_pending" && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-slate-600">
                <Hourglass className="size-4 shrink-0" /> Waiting on <ActorBadge actor="owner" />
              </div>
            )}
            {req.state === "human_review" && (
              <div className="space-y-2 rounded-lg border border-lane-review/30 bg-lane-review-bg/50 p-3 text-sm">
                <div className="font-medium text-navy">Confirm first: {view.flags.find((f) => f.code === "X1")?.detail.replace("Unclear: ", "") ?? "unclear clause"}</div>
                <Button size="sm" variant="secondary" onClick={() => confirmReview(req.id, "Procurement reviewed the unclear clause; routed to budget owner")}>
                  <CheckCircle2 /> Confirm · send to owner
                </Button>
              </div>
            )}
            {req.owner_decision && (
              <Hint content={req.owner_decision.reason}>
                <div className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium text-navy">
                  <ActorBadge actor="owner" /> chose {req.owner_decision.choice === "procurement" ? "Send to Procurement" : req.owner_decision.choice === "exit" ? "Exit" : "Renew"}
                </div>
              </Hint>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Flags</div>
              {view.flags.length ? view.flags.map((f) => <FlagLine key={f.code} f={f} />) : <p className="text-sm text-slate-500">None</p>}
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Evidence pack</div>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(view.flags.flatMap((f) => f.evidence ?? []).map((c) => c.doc_id))].map((id) => (
                  <a key={id} href={`/api/docs/${id}`} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs text-navy hover:bg-surface">
                    <Paperclip className="size-3" /> {id}
                  </a>
                ))}
                {confirmations.map((c) => (
                  <Hint key={c.alertId} content={c.note ?? "Confirmed by Finance"}>
                    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-lane-green-bg px-2.5 text-xs font-medium text-lane-green">
                      <CheckCircle2 className="size-3" /> Finance confirmed {c.flagCode}
                    </span>
                  </Hint>
                ))}
              </div>
              {s1 && <EvidenceLine icon={Activity} label={`SLA credit unclaimed · ${monthsOf(s1)}`} inr={s1.impactInr} confirmed={confirmations.some((c) => c.flagCode === "S1")} />}
              {u1 && <EvidenceLine icon={Users} label={`Unused ${metricLabel(String(u1.data?.metric))}`} inr={u1.impactInr} suffix="/yr" />}
            </div>

            {draft && (
              <div data-tour="draft-summary" className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-navy"><Mail className="size-4 shrink-0" /> <span className="truncate">{draft.subject}</span></div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{draft.source === "live" ? "Live AI draft" : "Template (cached)"}</Badge>
                  <Guard ok={draft.guardrails.boundary.ok} label="No negotiation" />
                  <Guard ok={draft.guardrails.numbers.ok} label="Numbers locked" />
                </div>
                <div className="text-xs text-slate-500">{req.state === "legal_pending" ? "With Legal for approval" : STATE_LABEL[req.state]}</div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="lg" className="flex-1" disabled={!actionable || !!busy} onClick={() => primary.run()}>
                {busy ? <Loader2 className="animate-spin" /> : <PrimaryIcon />}
                {actionable ? primary.label : waitingLabel}
                {primary.ai && actionable && <span className="text-xs opacity-80">· AI</span>}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" variant="outline" aria-label="More actions" disabled={!actionable || !!busy}><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {secondary.map((a) => (
                    <DropdownMenuItem key={a.id} onSelect={() => a.run()} className="gap-2 py-2">
                      <a.icon className="size-4" /> {a.label}
                      {a.outOfScope && <Badge variant="outline" className="ml-auto text-xs">Out of scope</Badge>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Hint content="Docket never negotiates. Drafts only use rights already in the contract; Legal approves and a human sends.">
              <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Lock className="size-3" /> Never negotiates · a human sends</span>
            </Hint>
          </div>
        </div>
      </div>

      {/* Citation side sheet */}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent data-tour="citation-sheet" className="w-[460px] sm:max-w-[460px]">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{FIELD_LABEL[open.key] ?? open.key}</SheetTitle>
                <SheetDescription className="text-base font-semibold text-navy">{fmtValue(open.key.split(".").pop()!, open.field.value, view.money.currency)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="flex flex-wrap gap-2">
                  <ConfidencePill value={open.field.confidence} unclear={open.field.value === "unclear"} />
                  <ExtractionBadge view={view} />
                  {open.field.ocr && <OcrChip />}
                  {open.field.source === "human" && <HumanChip note={open.field.note} />}
                </div>
                {open.field.citation ? (
                  <>
                    <blockquote className="rounded-lg border-l-4 border-brand bg-surface p-3 text-base leading-relaxed text-navy italic">“{open.field.citation.quote}”</blockquote>
                    <div className="text-sm text-slate-600">
                      {open.field.citation.doc_id} · §{open.field.citation.section}
                      {docOf(open.field.citation.doc_id)?.meta && ` · ${docOf(open.field.citation.doc_id)!.meta!.filename}`}
                    </div>
                    {open.field.via && (
                      <div className="rounded-lg border border-dashed p-3 text-sm">
                        <div className="font-medium text-navy">via {open.field.via.doc_id} §{open.field.via.section}</div>
                        <div className="mt-0.5 text-slate-600 italic">“{open.field.via.quote}”</div>
                      </div>
                    )}
                    {open.field.verified && <p className="flex items-center gap-1.5 text-sm font-medium text-lane-green"><CheckCircle2 className="size-4" /> Quote found verbatim in {open.field.citation.doc_id}{open.field.ocr ? " (OCR text)" : ""}</p>}
                    {open.field.note && <p className="text-sm text-slate-600">{open.field.note}</p>}
                    {open.field.overridden_by && <p className="text-sm font-medium text-src-docusign">Amended by {open.field.overridden_by} (latest executed amendment wins).</p>}
                    <Button asChild variant="outline">
                      <a href={`/api/docs/${open.field.citation.doc_id}`} target="_blank" rel="noreferrer"><ExternalLink /> Open {open.field.citation.doc_id} (PDF)</a>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">Not stated in the contract, so it is not used.</p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stat({ icon: Icon, label, value, caption, tone, warn }: { icon?: typeof Target; label: string; value: string; caption: string; tone?: "red" | "brand"; warn?: boolean }) {
  return (
    <div className={cn("min-w-32 rounded-xl px-4 py-3 text-center", tone === "red" ? "bg-lane-red-bg text-lane-red" : tone === "brand" ? "bg-surface-2 text-brand-strong" : "bg-surface text-navy")}>
      <div className="flex items-center justify-center gap-1 text-xs font-semibold tracking-wide uppercase opacity-80">{Icon && <Icon className="size-3.5" />} {label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      <div className={cn("text-xs", warn ? "font-semibold text-lane-amber" : "opacity-75")}>{caption}</div>
    </div>
  );
}

function ExtractionBadge({ view }: { view: SupplierView }) {
  if (view.source === "cache" && view.pipeline) {
    const p = view.pipeline;
    return (
      <Hint content={`Claude (${p.model}) read the PDFs${p.ocrDocs.length ? ` (OCR: ${p.ocrDocs.join(", ")})` : ""}. ${p.quotesChecked - p.quotesFailed}/${p.quotesChecked} cited quotes found verbatim. Dates and ₹ computed by Rules.`}>
        <Badge variant="secondary" className="gap-1"><BadgeCheck className="size-3.5" /> AI-extracted · quote-verified</Badge>
      </Hint>
    );
  }
  return (
    <Hint content="No AI extraction cached for this supplier: showing the seed (dev gold) as a fallback.">
      <Badge variant="outline">Seed · fallback</Badge>
    </Hint>
  );
}

function OcrChip() {
  return (
    <Hint content="Read from a scanned page by OCR: a human confirms it.">
      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-lane-review-bg px-2 text-xs font-medium text-lane-review"><ScanLine className="size-3.5" /> OCR</span>
    </Hint>
  );
}

function HumanChip({ note }: { note?: string }) {
  return (
    <Hint content={note}>
      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-lane-green-bg px-2 text-xs font-medium text-lane-green"><CheckCircle2 className="size-3.5" /> Human</span>
    </Hint>
  );
}

function Guard({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium", ok ? "bg-lane-green-bg text-lane-green" : "bg-lane-red-bg text-lane-red")}>
      {ok ? <CheckCircle2 className="size-3.5" /> : null} {label} {ok ? "" : "✗"}
    </span>
  );
}

function Panel({ title, actors, hint, children }: { title: string; actors?: ("AI" | "Rules" | "Human")[]; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {hint && <Hint content={hint}><Info className="size-4 text-slate-400" /></Hint>}
        {actors && <span className="ml-auto flex gap-1">{actors.map((a) => <ActorBadge key={a} actor={a} />)}</span>}
      </div>
      {children}
    </div>
  );
}

function FamilyRow({ d, family }: { d: FamilyDoc; family: FamilyDoc[] }) {
  const top = isTopLevel(d, family);
  const indent = top ? 0 : d.doc_role === "sow" || d.doc_role === "order_form" ? 1 : 2;
  const executed = d.executed === true ? "Executed" : d.executed === false ? "Draft / unsigned" : "Unknown";
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3", d.governs.length && "border-brand/30 bg-surface/60")} style={{ marginLeft: indent * 24 }}>
      <span className="w-24 shrink-0 text-sm font-semibold text-navy">{displayRole(d, family)}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-slate-800">{d.meta?.filename ?? d.doc_id}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {d.meta && <SourceChip source={d.meta.source} detail={d.meta.source_path} />}
          <Hint content={d.execution_evidence.join(" · ") || "No execution evidence"}>
            <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium", d.executed === true ? "bg-lane-green-bg text-lane-green" : "bg-lane-review-bg text-lane-review")}>
              {d.executed === true ? <CheckCircle2 className="size-3" /> : null} {executed}
            </span>
          </Hint>
          {d.grouping_evidence.length > 0 && (
            <Hint content={d.grouping_evidence.join(" · ")}>
              <span className="text-xs text-slate-500 underline decoration-dotted">why grouped</span>
            </Hint>
          )}
        </div>
      </div>
      {d.governs.length > 0 && (
        <Hint content={`Supplies: ${d.governs.map((g) => FIELD_LABEL[g] ?? g).join(", ")}`}>
          <Badge className="shrink-0">Wins · {d.governs.length}</Badge>
        </Hint>
      )}
      <a href={`/api/docs/${d.doc_id}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-brand" aria-label={`Open ${d.doc_id}`}>
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

const monthsOf = (f: Flag) => monthList((f.data?.months ?? []) as string[]);

function EvidenceLine({ icon: Icon, label, inr, suffix = "", confirmed }: { icon: typeof Activity; label: string; inr?: number; suffix?: string; confirmed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-1.5 text-navy"><Icon className="size-4 shrink-0 text-lane-amber" /> <span className="truncate">{label}</span>{confirmed && <CheckCircle2 className="size-3.5 shrink-0 text-lane-green" />}</span>
      <span className="font-semibold text-navy tabular-nums">{inr ? `${formatINRShort(inr)}${suffix}` : "—"}</span>
    </div>
  );
}

function PerformanceCard({ view }: { view: SupplierView }) {
  const s = view.sla!;
  const missed = s.monthsReported - s.monthsMet;
  return (
    <Panel title="Performance" actors={["Rules"]} hint="Monthly SLA reports vs the contract target. Credits = contract credit % × contracted monthly fee; claimed when the ledger has a CN- credit note.">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{metricLabel(s.metric)} ≥ {s.target}%</span>
          <span className="font-semibold text-navy">{s.monthsMet}/{s.monthsReported} months met</span>
        </div>
        <div className="flex gap-0.5" aria-label={`${s.monthsMet} months met, ${missed} missed`}>
          {[...new Set(s.months.map((m) => m.month))].map((m) => {
            const miss = s.months.some((x) => x.month === m && !x.met);
            return (
              <Hint key={m} content={`${monthLabel(m)}: ${s.months.filter((x) => x.month === m).map((x) => `${x.actual}%`).join(" / ")}`}>
                <span className={cn("h-3.5 w-full min-w-3 rounded-[3px]", miss ? "bg-lane-amber" : "bg-brand/60")} />
              </Hint>
            );
          })}
        </div>
        {s.noCreditTable ? (
          <p className="text-xs text-slate-500">No % credit table in the contract, so credits aren&apos;t computed.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-surface p-2.5"><div className="text-xs text-slate-500">Credits due</div><div className="text-base font-semibold text-navy">{formatINRShort(s.creditsDueInr)}</div></div>
            <div className="rounded-lg bg-surface p-2.5"><div className="text-xs text-slate-500">Claimed</div><div className={cn("text-base font-semibold", s.unclaimedInr ? "text-lane-amber" : "text-lane-green")}>{formatINRShort(s.creditsClaimedInr)}</div></div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function UtilisationCard({ view }: { view: SupplierView }) {
  const u = view.utilisation!;
  const line = u.lines.find((l) => l.flagged) ?? u.lines[0];
  return (
    <Panel title="Utilisation" actors={["Rules"]} hint="Active vs licensed units (admin console vs the order form). Docket informs only.">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">{metricLabel(line.metric)}</span>
          <span className="font-semibold text-navy">{line.latest_active}/{line.licensed_units} · {Math.round(line.latest_pct)}%</span>
        </div>
        <MiniBars mode="utilisation" months={line.months.map((m) => ({ period: m.month, amount: m.pct }))} contracted={u.flagPct} height={56} />
        {line.flagged && <p className="text-sm text-lane-amber">~{lakh1(line.unused_value_inr)}/yr of licences unused</p>}
      </div>
    </Panel>
  );
}

function FlagLine({ f }: { f: Flag }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <FlagChip code={f.code} detail={f.detail} />
      {f.impactInr ? <span className="text-sm font-semibold text-navy tabular-nums">{formatINRShort(f.impactInr)}</span> : null}
    </div>
  );
}
