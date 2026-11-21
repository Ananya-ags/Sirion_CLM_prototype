import { CalendarClock, FileStack, Inbox, ShieldCheck, Wallet } from "lucide-react";
import { ActorBadge, ConfidencePill, EmptyState, FlagChip, LaneBadge, MetricCard, SourceChip } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FLAGS } from "@/lib/flags";
import { formatINR, formatINRShort } from "@/lib/format";
import type { FlagCode, Lane, SourceKind } from "@/lib/types";

const SWATCHES = [
  { name: "Navy", cls: "bg-navy", hex: "#0F1E3D" },
  { name: "Primary", cls: "bg-brand", hex: "#2563EB" },
  { name: "Indigo", cls: "bg-indigo", hex: "#4F46E5" },
  { name: "Surface", cls: "bg-surface border", hex: "#F5F9FF" },
  { name: "Surface 2", cls: "bg-surface-2", hex: "#EAF2FF" },
  { name: "Lane green", cls: "bg-lane-green", hex: "lane only" },
  { name: "Lane amber", cls: "bg-lane-amber", hex: "lane only" },
  { name: "Lane red", cls: "bg-lane-red", hex: "lane only" },
];

const LANES: Lane[] = ["green", "amber", "red", "needs_review"];
const SOURCES: SourceKind[] = ["email", "sharepoint", "docusign", "tracker", "ledger"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div className="space-y-10">
      <Section title="Colour">
        <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
          {SWATCHES.map((s) => (
            <div key={s.name} className="space-y-1.5">
              <div className={`h-14 rounded-xl ${s.cls}`} />
              <div className="text-xs font-medium text-navy">{s.name}</div>
              <div className="text-xs text-muted-foreground">{s.hex}</div>
            </div>
          ))}
        </div>
        <div className="h-16 rounded-xl bg-hero-gradient" />
      </Section>

      <Section title="MetricCard">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard variant="gradient" label="Renewals caught" value="38" sublabel="next 120 days" icon={Inbox} hint="Contracts Docket raised a request for on its own." />
          <MetricCard label="Need you" value="7" sublabel="red + needs review" icon={ShieldCheck} />
          <MetricCard label="Value at stake" value={formatINRShort(62_00_000)} sublabel={formatINR(62_00_000)} icon={Wallet} />
          <MetricCard label="Next act-by" value="9 Dec" sublabel="14 days · Red" icon={CalendarClock} />
        </div>
      </Section>

      <Section title="LaneBadge">
        <div className="flex flex-wrap gap-2">
          {LANES.map((l) => (
            <LaneBadge key={l} lane={l} />
          ))}
        </div>
      </Section>

      <Section title="SourceChip">
        <div className="flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <SourceChip key={s} source={s} detail={`Example ${s} source path`} />
          ))}
        </div>
      </Section>

      <Section title="ActorBadge">
        <div className="flex flex-wrap items-center gap-2">
          <ActorBadge actor="AI" />
          <ActorBadge actor="Rules" />
          <ActorBadge actor="Human" />
          <ActorBadge actor="procurement" />
          <ActorBadge actor="legal" />
        </div>
      </Section>

      <Section title="ConfidencePill">
        <div className="flex flex-wrap items-center gap-2">
          <ConfidencePill value={0.97} />
          <ConfidencePill value={0.86} />
          <ConfidencePill value={0.72} />
          <ConfidencePill value={0} unclear />
        </div>
      </Section>

      <Section title="FlagChip">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FLAGS) as FlagCode[]).map((c) => (
            <FlagChip key={c} code={c} />
          ))}
          <FlagChip code="T1" resolved detail="Tracker said 60 days' notice; executed MSA §12.2 says 90." />
        </div>
      </Section>

      <Section title="Card + step row (example composition)">
        <Card className="max-w-xl rounded-xl shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-navy">
              Acme Cloud Pvt Ltd <LaneBadge lane="red" />
            </CardTitle>
            <CardDescription>Auto-renews 1 Jan 2027 · act-by 2 Dec 2026</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { a: "AI" as const, t: "Extracted notice clause (MSA §14.1)", c: 0.93 },
              { a: "Rules" as const, t: "Act-by = 1 Jan 2027 − 30 calendar days", c: null },
              { a: "procurement" as const, t: "Decision pending", c: null },
            ].map((s) => (
              <div key={s.t} className="flex items-center gap-3">
                <ActorBadge actor={s.a} />
                <span className="flex-1 text-navy">{s.t}</span>
                {s.c !== null && <ConfidencePill value={s.c} />}
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <FlagChip code="F3" detail="Quote +9.0% vs contract cap 5.0%" />
              <FlagChip code="X2" detail="Notice by registered post to legal@acme.example" />
              <SourceChip source="docusign" />
            </div>
            <Progress value={62} className="h-1.5" />
          </CardContent>
        </Card>
      </Section>

      <Section title="Buttons + badges">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
          <Badge>Badge</Badge>
          <Badge variant="secondary">Cached</Badge>
          <Badge variant="outline">Out of scope</Badge>
        </div>
      </Section>

      <Section title="EmptyState">
        <EmptyState icon={FileStack} tag="Placeholder" title="Nothing here yet" description="Details live in tooltips and drawers; screens stay quiet." action={<Button variant="outline">Action</Button>} />
      </Section>
    </div>
  );
}
