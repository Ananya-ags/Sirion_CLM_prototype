"use client";

import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, Hand, IndianRupee, TableProperties } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActorBadge, FlagChip, Hint, LaneBadge, MetricCard, SourceChip, StateChip } from "@/components/docket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatINRShort } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import type { Portfolio } from "@/lib/portfolio";
import type { Lane } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReviewQueue } from "./ReviewQueue";
import { useLiveViews } from "./useLiveViews";
import { useRequestMap } from "./useRequest";

type Filter = "all" | Lane;
const HORIZON = 120;

export function InboxView({ views: serverViews, unmatched, sources }: Pick<Portfolio, "views" | "unmatched" | "sources">) {
  const views = useLiveViews(serverViews);
  const router = useRouter();
  const req = useRequestMap(views);
  const [filter, setFilter] = useState<Filter>("all");

  const due = views.filter((v) => v.actBy && v.actBy.daysToActBy >= 0 && v.actBy.daysToActBy <= HORIZON);
  const atStake = due.reduce((a, v) => a + v.money.annualInr, 0);
  const greens = views.filter((v) => v.lane === "green").length;
  // Priya acts once the owner has decided (procurement_review) or a clause needs human review; unmatched docs too.
  const needsYou = views.filter((v) => ["procurement_review", "human_review"].includes(req[v.supplierId].state)).length + unmatched.length;
  const withOwner = views.filter((v) => req[v.supplierId].state === "owner_pending").length;
  const conflicts = views.reduce((a, v) => a + v.trackerConflicts.length, 0);
  const silent = views.filter((v) => v.flags.some((f) => f.code === "L4"));

  const rows = useMemo(
    () =>
      views
        .filter((v) => filter === "all" || v.lane === filter)
        .sort((a, b) => (a.actBy?.daysToActBy ?? 9999) - (b.actBy?.daysToActBy ?? 9999)),
    [views, filter],
  );
  const count = (l: Lane) => views.filter((v) => v.lane === l).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard variant="gradient" label="₹ at stake · next 120 days" value={formatINRShort(atStake)} sublabel={`${due.length} contracts renew by default`} icon={IndianRupee} hint="Annual value of contracts whose act-by date falls in the next 120 days. Rules compute it." />
        <MetricCard variant="gradient" label="Renewals due" value={String(due.length)} sublabel="raised by Docket itself" icon={CalendarClock} />
        <MetricCard variant="gradient" label="Auto-cleared (green)" value={String(greens)} sublabel="logged, reversible" icon={CheckCircle2} />
        <MetricCard variant="gradient" label="Need you" value={String(needsYou)} sublabel={`review + decided · ${withOwner} with budget owner`} icon={Hand} hint="Requests the budget owner has decided, clauses needing human review, and unmatched documents. Red and amber renewals go to the budget owner first." />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Strip icon={TableProperties} tone="amber" text={`${conflicts} tracker conflicts`} detail="The Excel tracker disagrees with the executed contracts. Rules compare them field by field." href={`/contracts/${views.find((v) => v.trackerConflicts.length)?.supplierId ?? ""}`} />
        {silent.map((v) => (
          <Strip key={v.supplierId} icon={BellRing} tone="red" text={`1 silent renewal found in ledger (${v.name.split(" ")[0]})`} detail={`${v.ledgerSummary.service_periods.length} months of spend, no tracker row, no PO. Contract found only in a shared mailbox.`} href={`/contracts/${v.supplierId}`} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <Card className="rounded-xl shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-navy">
              Renewal requests <ActorBadge actor="Rules" />
            </CardTitle>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                <TabsTrigger value="all">All {views.length}</TabsTrigger>
                <TabsTrigger value="red">Red {count("red")}</TabsTrigger>
                <TabsTrigger value="amber">Amber {count("amber")}</TabsTrigger>
                <TabsTrigger value="green">Green {count("green")}</TabsTrigger>
                <TabsTrigger value="needs_review">Review {count("needs_review")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Act-by</TableHead>
                  <TableHead className="text-right">Days</TableHead>
                  <TableHead className="text-right">₹ at stake</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Lane</TableHead>
                  <TableHead>State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((v) => {
                  const days = v.actBy?.daysToActBy;
                  const exposure = v.flags.reduce((a, f) => a + (f.impactInr ?? 0), 0);
                  return (
                    <TableRow key={v.supplierId} className="cursor-pointer" onClick={() => router.push(`/contracts/${v.supplierId}`)}>
                      <TableCell>
                        <div className="font-medium text-navy">{v.name}</div>
                        <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[v.category]}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{v.actBy ? formatDate(v.actBy.actBy) : <span className="text-muted-foreground">{v.lane === "needs_review" ? "Unclear" : v.money.earliestExit ? "Evergreen" : "Expired"}</span>}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", days != null && days <= 14 && "font-semibold text-lane-red")}>{days ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Hint content={exposure ? `Flag exposure ${formatINRShort(exposure)}` : undefined}>
                          <span>{formatINRShort(v.money.annualInr)}</span>
                        </Hint>
                        {exposure > 0 && <div className="text-[11px] text-muted-foreground">+{formatINRShort(exposure)} risk</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-64 flex-wrap gap-1">
                          {v.flags.filter((f) => f.code !== "F1").map((f) => (
                            <FlagChip key={f.code} code={f.code} detail={f.detail} />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell><LaneBadge lane={v.lane} /></TableCell>
                      <TableCell><StateChip state={req[v.supplierId].state} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ReviewQueue views={views} unmatched={unmatched} />
          <Card className="rounded-xl shadow-soft">
            <CardHeader>
              <CardTitle className="text-sm text-navy">Sources scanned</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(["email", "sharepoint", "docusign", "tracker", "ledger"] as const).map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <SourceChip source={s} />
                  <span className="text-sm font-semibold text-navy tabular-nums">
                    {sources[s]} <span className="text-xs font-normal text-muted-foreground">{s === "tracker" ? "rows" : s === "ledger" ? "invoices" : "docs"}</span>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Strip({ icon: Icon, tone, text, detail, href }: { icon: typeof AlertTriangle; tone: "amber" | "red"; text: string; detail: string; href: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-inset transition-colors", tone === "red" ? "bg-lane-red-bg text-lane-red ring-lane-red/20 hover:bg-lane-red-bg/70" : "bg-lane-amber-bg text-lane-amber ring-lane-amber/25 hover:bg-lane-amber-bg/70")}>
      <Icon className="size-4 shrink-0" />
      <span className="text-sm font-semibold">{text}</span>
      <span className="truncate text-xs opacity-80">{detail}</span>
    </Link>
  );
}
