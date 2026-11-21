"use client";

import { ArrowRightLeft, CheckCircle2, DoorOpen, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ActorBadge, EmptyState, LaneBadge, StateChip } from "@/components/docket";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FLAGS } from "@/lib/flags";
import { formatDate, formatINRShort } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/labels";
import type { SupplierView } from "@/lib/seed";
import type { OwnerChoice } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ownerDecide } from "@/store/actions";
import { useRequestMap } from "./useRequest";

/** Plain-language flag sentences for budget owners (numbers from Rules). */
function plain(code: string, impact?: number, detail?: string) {
  const r = impact ? ` (${formatINRShort(impact)})` : "";
  switch (code) {
    case "F2": return `The price goes up automatically at renewal${r}.`;
    case "F3": return `The supplier quoted more than the contract allows${r}.`;
    case "F4": return `We pay more than the market rate${r} a year.`;
    case "F6": return "We can't exit early: there's no termination for convenience.";
    case "L1": return `We've spent more than the contract value${r}.`;
    case "L2": return `We kept paying after the contract ended${r}.`;
    case "L3": return `Invoices are above the agreed price${r}.`;
    case "L4": return `Recurring spend isn't on the tracker${r}.`;
    case "T1": return "Our tracker disagrees with the signed contract.";
    case "X2": return "Notice must go by a special method (e.g. registered post).";
    case "X1": return "A key clause is unclear; Procurement is checking it.";
    default: return detail ?? FLAGS[code as keyof typeof FLAGS]?.label ?? code;
  }
}

const OPEN = ["raised", "owner_pending"];

export function RequestsView({ views }: { views: SupplierView[] }) {
  const req = useRequestMap(views);
  const mine = views
    .filter((v) => v.lane !== "green")
    .sort((a, b) => Number(!OPEN.includes(req[a.supplierId].state)) - Number(!OPEN.includes(req[b.supplierId].state)) || (a.actBy?.daysToActBy ?? 999) - (b.actBy?.daysToActBy ?? 999));
  if (!mine.length) return <EmptyState icon={CheckCircle2} title="Nothing needs you" />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Docket raised these renewals for you. Answer two questions and choose. Procurement handles anything risky.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {mine.map((v) => <RequestCard key={v.supplierId} v={v} state={req[v.supplierId].state} decided={req[v.supplierId].owner_decision?.choice} />)}
      </div>
    </div>
  );
}

function RequestCard({ v, state, decided }: { v: SupplierView; state: string; decided?: OwnerChoice }) {
  const [needed, setNeeded] = useState<string | null>(null);
  const [scope, setScope] = useState<string | null>(null);
  const open = OPEN.includes(state) && v.lane !== "needs_review";
  const flags = v.flags.filter((f) => f.code !== "F1");
  const id = `REQ-${v.supplierId}`;
  const go = (c: OwnerChoice) => ownerDecide(id, v.lane, c, { needed: needed ?? "not answered", scope: scope ?? "not answered" });
  return (
    <Card className={cn("rounded-xl shadow-soft", !open && "opacity-75")}>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-navy">
          <div>
            <div>{v.name}</div>
            <div className="mt-1 text-xs font-normal text-muted-foreground">
              {CATEGORY_LABEL[v.category]} · {formatINRShort(v.money.annualInr)}/yr · {v.actBy ? `decide by ${formatDate(v.actBy.actBy)} (${v.actBy.daysToActBy} days)` : v.money.earliestExit ? "rolling month-to-month" : "no renewal date"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1"><LaneBadge lane={v.lane} /><StateChip state={state as never} /></div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><ActorBadge actor="AI" /> Pre-filled from the signed contract · <ActorBadge actor="Rules" /> dates and ₹</div>
        {flags.length > 0 && (
          <ul className="space-y-1.5">
            {flags.map((f) => (
              <li key={f.code} className="flex gap-2 text-sm text-navy">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", f.severity === "material" ? "bg-lane-red" : f.severity === "minor" ? "bg-lane-amber" : "bg-lane-review")} />
                {plain(f.code, f.impactInr, f.detail)}
              </li>
            ))}
          </ul>
        )}
        {open ? (
          <>
            <Question label="Still needed?" options={["Yes", "No"]} value={needed} onChange={setNeeded} />
            <Question label="Same scope or seats?" options={["Same", "Fewer", "More"]} value={scope} onChange={setScope} />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => go("renew")} disabled={!needed || !scope}><RefreshCw /> Renew</Button>
              <Button variant="secondary" onClick={() => go("exit")} disabled={!needed || !scope}><DoorOpen /> Exit</Button>
              <Button variant="outline" onClick={() => go("procurement")} disabled={!needed || !scope}><ArrowRightLeft /> Send to Procurement</Button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><ActorBadge actor="owner" /> decides · then <ActorBadge actor="Rules" /> routes</div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{v.lane === "needs_review" ? "Procurement is confirming an unclear clause before you're asked." : decided ? `You chose ${decided === "procurement" ? "Send to Procurement" : decided}.` : "Handled by Procurement."}</p>
        )}
      </CardContent>
    </Card>
  );
}

function Question({ label, options, value, onChange }: { label: string; options: string[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-navy">{label}</span>
      <div className="flex gap-1 rounded-full bg-surface p-0.5">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", value === o ? "bg-brand text-white shadow-soft" : "text-muted-foreground hover:text-navy")}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
