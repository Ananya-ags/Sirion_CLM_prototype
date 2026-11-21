"use client";

import { ArrowRightLeft, CheckCircle2, DoorOpen, RefreshCw, Users } from "lucide-react";
import { useState } from "react";
import { EmptyState, Hint, LaneBadge, StateChip } from "@/components/docket";
import { Button } from "@/components/ui/button";
import { formatDate, formatINRShort } from "@/lib/format";
import { CATEGORY_LABEL, lakh1, metricLabel } from "@/lib/labels";
import { plainFlag } from "@/lib/plain";
import { OWNER_OPEN } from "@/lib/requestFlow";
import type { SupplierView } from "@/lib/seed";
import type { OwnerChoice, RequestState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ownerDecide } from "@/store/actions";
import { useLiveViews } from "./useLiveViews";
import { useRequestMap } from "./useRequest";

const OPEN: string[] = OWNER_OPEN;

/** U1 in plain words, numbers from Rules. Informs only: no recommendation. */
function seatsLine(v: SupplierView): string | null {
  const u1 = v.flags.find((f) => f.code === "U1");
  if (!u1?.data) return null;
  const d = u1.data as { metric: string; latest_active: number; licensed_units: number; latest_pct: number };
  return `You use ${d.latest_active} of ${d.licensed_units} ${metricLabel(d.metric)} (${Math.round(d.latest_pct)}%) · ~${lakh1(u1.impactInr ?? 0)}/yr unused`;
}

export function RequestsView({ views: serverViews }: { views: SupplierView[] }) {
  const views = useLiveViews(serverViews);
  const req = useRequestMap(views);
  const mine = views
    .filter((v) => v.lane !== "green")
    .sort((a, b) => Number(!OPEN.includes(req[a.supplierId].state)) - Number(!OPEN.includes(req[b.supplierId].state)) || (a.actBy?.daysToActBy ?? 999) - (b.actBy?.daysToActBy ?? 999));
  const open = mine.filter((v) => OPEN.includes(req[v.supplierId].state));
  const done = mine.filter((v) => !OPEN.includes(req[v.supplierId].state));
  return (
    <div className="space-y-8">
      <p className="text-base text-slate-700">Docket raised these renewals for you. Answer two questions, then choose.</p>
      {open.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {open.map((v) => <RequestCard key={v.supplierId} v={v} state={req[v.supplierId].state} />)}
        </div>
      ) : (
        <EmptyState icon={CheckCircle2} title="Nothing waiting on you" description="New renewals appear here before their notice deadline." />
      )}
      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Already handled</h2>
          <div className="divide-y rounded-xl border bg-card shadow-soft">
            {done.map((v) => {
              const r = req[v.supplierId];
              return (
                <div key={v.supplierId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span className="text-base font-medium text-navy">{v.name}</span>
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    {r.state === "human_review" ? "Procurement is checking a clause first" : r.owner_decision ? `You chose ${r.owner_decision.choice === "procurement" ? "Send to Procurement" : r.owner_decision.choice}` : "Handled by Procurement"}
                    <StateChip state={r.state} />
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function RequestCard({ v, state }: { v: SupplierView; state: RequestState }) {
  const [needed, setNeeded] = useState<string | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const found = v.flags.filter((f) => f.code !== "F1" && f.code !== "U1"); // U1 sits next to the seats question
  const shown = found.slice(0, 3);
  const more = found.slice(3);
  const seats = seatsLine(v);
  const id = `REQ-${v.supplierId}`;
  const ready = !!needed && !!scope;
  const go = (c: OwnerChoice) => ownerDecide(id, v.lane, c, { needed: needed ?? "not answered", scope: scope ?? "not answered" });
  return (
    <div data-tour={`req-${v.supplierId}`} className="flex flex-col rounded-xl border bg-card p-6 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">{v.name}</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {CATEGORY_LABEL[v.category]} · {formatINRShort(v.money.annualInr)}/yr ·{" "}
            {v.actBy ? <span className={cn(v.actBy.daysToActBy <= 14 && "font-semibold text-lane-red")}>decide by {formatDate(v.actBy.actBy)}</span> : v.money.earliestExit ? "rolling month to month" : "no renewal date"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1"><LaneBadge lane={v.lane} /><StateChip state={state} /></div>
      </div>

      <div className="mt-4 rounded-lg bg-surface p-4">
        <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">What we found</div>
        {shown.length ? (
          <ul className="mt-2 space-y-1.5">
            {shown.map((f) => (
              <li key={f.code} className="flex gap-2 text-base text-navy">
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", f.severity === "material" ? "bg-lane-red" : f.severity === "minor" ? "bg-lane-amber" : "bg-lane-review")} />
                {plainFlag(f)}
              </li>
            ))}
            {more.length > 0 && (
              <Hint content={more.map((f) => plainFlag(f)).join("\n")}>
                <li className="cursor-help pl-4 text-sm font-medium text-brand">+{more.length} more</li>
              </Hint>
            )}
          </ul>
        ) : (
          <p className="mt-2 text-base text-navy">Nothing unusual. A routine renewal.</p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <Question label="Still needed?" options={["Yes", "No"]} value={needed} onChange={setNeeded} />
        <Question label="Same scope or seats?" options={["Same", "Fewer", "More"]} value={scope} onChange={setScope} note={seats} noteId={v.supplierId} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2" title={ready ? undefined : "Answer both questions to choose"}>
        <Button size="lg" className="flex-1" onClick={() => go("renew")} disabled={!ready}><RefreshCw /> Renew</Button>
        <Button size="lg" className="flex-1" variant="secondary" onClick={() => go("exit")} disabled={!ready}><DoorOpen /> Exit</Button>
        <Button size="lg" className="flex-[1.6]" variant="outline" onClick={() => go("procurement")} disabled={!ready}><ArrowRightLeft /> Send to Procurement</Button>
      </div>
    </div>
  );
}

function Question({ label, options, value, onChange, note, noteId }: { label: string; options: string[]; value: string | null; onChange: (v: string) => void; note?: string | null; noteId?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-base font-medium text-navy">{label}</div>
        {note && (
          <Hint content="Admin console vs the order form (Rules). Docket informs only; the seat count is your call.">
            <span data-tour={`seats-${noteId}`} className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-lane-amber"><Users className="size-4 shrink-0" /> {note}</span>
          </Hint>
        )}
      </div>
      <div className="flex shrink-0 gap-1 rounded-full bg-surface p-1">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", value === o ? "bg-brand text-white shadow-soft" : "text-slate-600 hover:text-navy")}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
