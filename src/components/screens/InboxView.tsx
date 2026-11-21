"use client";

import { ArrowRight, BellRing, CalendarClock, CheckCircle2, Database, Hand, IndianRupee, TableProperties, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FlagChips, Hint, LaneBadge, SectionHeader, StateChip } from "@/components/docket";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatINRShort } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import type { Portfolio } from "@/lib/portfolio";
import type { SupplierView } from "@/lib/seed";
import type { Lane } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReviewQueue } from "./ReviewQueue";
import { useLiveViews } from "./useLiveViews";
import { useRequestMap } from "./useRequest";

const HORIZON = 120;
type LaneTab = "all" | Lane;
/** Card / alert filters on top of the lane tabs. */
type Focus = null | "due_value" | "due_date" | "needs_me" | "conflicts" | "silent";

const FOCUS_LABEL: Record<Exclude<Focus, null>, string> = {
  due_value: "Due in 120 days · by ₹",
  due_date: "Due in 120 days · by date",
  needs_me: "Needs your decision",
  conflicts: "Tracker conflicts",
  silent: "Silent renewals",
};

export function InboxView({ views: serverViews, unmatched, sources }: Pick<Portfolio, "views" | "unmatched" | "sources">) {
  const views = useLiveViews(serverViews);
  const router = useRouter();
  const req = useRequestMap(views);
  const [tab, setTab] = useState<LaneTab>("all");
  const [focus, setFocus] = useState<Focus>(null);

  const isDue = (v: SupplierView) => !!v.actBy && v.actBy.daysToActBy >= 0 && v.actBy.daysToActBy <= HORIZON;
  const needsMe = (v: SupplierView) => ["procurement_review", "human_review"].includes(req[v.supplierId].state);
  // Alerts are computed from the rules output, never hard-coded.
  const hasConflict = (v: SupplierView) => v.trackerConflicts.length > 0 || v.flags.some((f) => f.code === "T1");
  const isSilent = (v: SupplierView) => v.flags.some((f) => f.code === "L4");

  const due = views.filter(isDue);
  const atStake = due.reduce((a, v) => a + v.money.annualInr, 0);
  const greens = views.filter((v) => v.lane === "green");
  const mine = views.filter(needsMe);
  const conflictViews = views.filter(hasConflict);
  const conflictCount = views.reduce((a, v) => a + v.trackerConflicts.length, 0);
  const silent = views.filter(isSilent);

  const rows = useMemo(() => {
    let r = views.filter((v) => tab === "all" || v.lane === tab);
    if (focus === "due_value" || focus === "due_date") r = r.filter(isDue);
    if (focus === "needs_me") r = r.filter(needsMe);
    if (focus === "conflicts") r = r.filter(hasConflict);
    if (focus === "silent") r = r.filter(isSilent);
    return focus === "due_value" ? r.sort((a, b) => b.money.annualInr - a.money.annualInr) : r.sort((a, b) => (a.actBy?.daysToActBy ?? 9999) - (b.actBy?.daysToActBy ?? 9999));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, tab, focus, req]);
  const count = (l: Lane) => views.filter((v) => v.lane === l).length;
  const pick = (f: Focus) => {
    setFocus((cur) => (cur === f ? null : f));
    setTab("all");
    document.getElementById("queue")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-8">
      {/* 1 · Snapshot */}
      <section data-tour="snapshot">
        <SectionHeader title="Renewal snapshot · next 120 days" caption="Click a card to filter" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SnapCard icon={IndianRupee} label="Money at stake" value={formatINRShort(atStake)} caption={`${due.length} contracts renew by default`} active={focus === "due_value"} onClick={() => pick("due_value")} hint="Annual value of contracts whose act-by date falls in the next 120 days (Rules)." />
          <SnapCard icon={CalendarClock} label="Renewals coming due" value={String(due.length)} caption="raised by Docket itself" active={focus === "due_date"} onClick={() => pick("due_date")} />
          <SnapCard icon={CheckCircle2} label="Cleared automatically" value={String(greens.length)} caption="green lane · reversible" active={tab === "green" && !focus} onClick={() => { setFocus(null); setTab((t) => (t === "green" ? "all" : "green")); }} />
          <SnapCard icon={Hand} label="Need your decision" value={String(mine.length + unmatched.length)} caption={`${views.filter((v) => req[v.supplierId].state === "owner_pending").length} with budget owners`} active={focus === "needs_me"} onClick={() => pick("needs_me")} hint="Owner has decided, or a field needs human review; plus unmatched documents. Red and amber go to the budget owner first." />
        </div>
      </section>

      {/* 2 · Alerts */}
      <section data-tour="alerts">
        <SectionHeader title="Alerts" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AlertCard icon={TableProperties} tone="amber" title="Tracker conflicts" count={conflictCount} line={`Tracker ≠ signed contract · ${conflictViews.length} suppliers`} onView={() => pick("conflicts")} active={focus === "conflicts"} />
          <AlertCard icon={BellRing} tone="red" title="Silent renewals" count={silent.length} line="Ledger spend, no tracker row" onView={() => pick("silent")} active={focus === "silent"} />
          <Hint content={(["email", "sharepoint", "docusign", "tracker", "ledger"] as const).map((k) => `${k === "sharepoint" ? "SharePoint" : k === "docusign" ? "DocuSign" : k[0].toUpperCase() + k.slice(1)}: ${sources[k]}`).join("\n")}>
            <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand"><Database className="size-5" /></span>
              <div>
                <div className="text-base font-semibold text-navy">Where the data came from</div>
                <p className="text-xs text-slate-600">{sources.email + sources.sharepoint + sources.docusign} documents · {sources.ledger} invoices · {sources.tracker} tracker rows</p>
              </div>
            </div>
          </Hint>
        </div>
      </section>

      {/* 3 · Human review */}
      <section>
        <SectionHeader title="Needs human review" />
        <ReviewQueue views={views} unmatched={unmatched} />
      </section>

      {/* 4 · Queue */}
      <section id="queue" className="scroll-mt-24">
          <SectionHeader
            title="Renewals queue"
            right={
              <Tabs value={tab} onValueChange={(v) => setTab(v as LaneTab)}>
                <TabsList>
                  <TabsTrigger value="all">All {views.length}</TabsTrigger>
                  <TabsTrigger value="red">Red {count("red")}</TabsTrigger>
                  <TabsTrigger value="amber">Amber {count("amber")}</TabsTrigger>
                  <TabsTrigger value="green">Green {count("green")}</TabsTrigger>
                  <TabsTrigger value="needs_review">Needs review {count("needs_review")}</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
          {focus && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 pr-1 pl-3 text-sm font-medium text-brand-strong">
                {FOCUS_LABEL[focus]} · {rows.length}
                <button aria-label="Clear filter" onClick={() => setFocus(null)} className="grid size-5 place-items-center rounded-full hover:bg-white"><X className="size-3.5" /></button>
              </span>
            </div>
          )}
          <div className="max-h-[460px] overflow-auto rounded-xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_var(--border)]">
                <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-3 py-3">Act-by</th>
                  <th className="px-3 py-3 text-right whitespace-nowrap">₹ / year</th>
                  <th className="px-3 py-3">Flags</th>
                  <th className="px-3 py-3">Lane</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const days = v.actBy?.daysToActBy;
                  return (
                    <tr key={v.supplierId} onClick={() => router.push(`/contracts/${v.supplierId}`)} className="cursor-pointer border-t transition-colors hover:bg-surface">
                      <td className="px-4 py-3">
                        <Hint content={CATEGORY_LABEL[v.category]}>
                          <span className="font-semibold whitespace-nowrap text-navy">{v.name}</span>
                        </Hint>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {v.actBy ? (
                          <>
                            <div className="text-slate-800">{formatDate(v.actBy.actBy)}</div>
                            <div className={cn("text-xs", days != null && days <= 14 ? "font-semibold text-lane-red" : "text-slate-500")}>in {days} days</div>
                          </>
                        ) : (
                          <span className="text-slate-500">{v.lane === "needs_review" ? "Unclear" : v.money.earliestExit ? "Rolling" : "Expired"}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-slate-800 tabular-nums">{formatINRShort(v.money.annualInr)}</td>
                      <td className="px-3 py-3"><FlagChips flags={v.flags} /></td>
                      <td className="px-3 py-3"><LaneBadge lane={v.lane} /></td>
                      <td className="px-3 py-3"><StateChip state={req[v.supplierId].state} /></td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Nothing here with this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
    </div>
  );
}

function SnapCard({ icon: Icon, label, value, caption, active, onClick, hint }: { icon: LucideIcon; label: string; value: string; caption: string; active: boolean; onClick: () => void; hint?: string }) {
  const body = (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn("relative w-full overflow-hidden rounded-xl bg-hero-gradient p-5 text-left text-white shadow-lift transition-transform hover:-translate-y-0.5", active && "ring-4 ring-brand/30 ring-offset-2")}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-base font-semibold text-white">{label}</span>
        <span className="grid size-9 place-items-center rounded-lg bg-white/15"><Icon className="size-5" /></span>
      </div>
      <div className="mt-2 text-[2rem] leading-tight font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-0.5 flex items-center justify-between text-xs text-white/80">
        <span>{caption}</span>
        <ArrowRight className={cn("size-4 text-white/90 transition-transform", active && "rotate-90")} />
      </div>
    </button>
  );
  return hint ? <Hint content={hint}>{body}</Hint> : body;
}

function AlertCard({ icon: Icon, tone, title, count, line, onView, active }: { icon: LucideIcon; tone: "amber" | "red"; title: string; count: number; line: string; onView: () => void; active: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border bg-card p-4 shadow-soft", active && "ring-2 ring-brand/40")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tone === "red" ? "bg-lane-red-bg text-lane-red" : "bg-lane-amber-bg text-lane-amber")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-base font-semibold text-navy">{title}</span>
          <span className={cn("text-xl font-semibold tabular-nums", tone === "red" ? "text-lane-red" : "text-lane-amber")}>{count}</span>
        </div>
        <p className="text-xs text-slate-600">{line}</p>
      </div>
      <Button size="sm" className="text-sm" variant={active ? "default" : "outline"} onClick={onView} disabled={!count}>View</Button>
    </div>
  );
}
