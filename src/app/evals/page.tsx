import { CheckCircle2, CircleDashed, FlaskConical, Info, XCircle } from "lucide-react";
import { ActorBadge } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { loadCache } from "@/lib/data";
import { EvalResultsSchema, type Score, type SuiteResult } from "@/lib/evals";
import { cn } from "@/lib/utils";

const GUARDRAILS: [string, string, "AI" | "Rules" | "Human"][] = [
  ["Every field needs a verbatim citation", "Hallucinated terms. A quote not found in the source becomes “unclear” at 0 confidence.", "Rules"],
  ["“Unclear” is a valid answer", "Confident guessing on ambiguous clauses (e.g. Sentinel's two renewal readings).", "AI"],
  ["The LLM never does arithmetic", "Wrong dates and ₹. Rules compute every figure; drafts receive them as locked values.", "Rules"],
  ["Negotiation-boundary + numeric checks on drafts", "Docket negotiating, or a letter with a changed deadline or amount.", "Rules"],
  ["Document text is untrusted", "Prompt injection hidden in a contract.", "AI"],
  ["Humans send; humans confirm OCR and unclear fields", "Irreversible external actions and unverified scans. Everything is audit-logged.", "Human"],
];

async function getEvalResults() {
  "use cache";
  return loadCache("eval_results", EvalResultsSchema.nullable(), null);
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const show = (v: unknown) => (v === null || v === undefined ? "null" : typeof v === "string" ? v : JSON.stringify(v));

function Headline({ title, sub, s, before }: { title: string; sub: string; s: Score | null; before?: { label: string; s: Score | null; why: string } }) {
  if (!s) return <Card className="rounded-xl shadow-soft"><CardContent className="py-6 text-sm text-muted-foreground">{title}: not run</CardContent></Card>;
  const ok = s.correct + s.correct_abstention;
  return (
    <Card className="rounded-xl shadow-soft">
      <CardHeader>
        <CardTitle className="text-navy">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold text-navy tabular-nums">{ok}<span className="text-lg text-muted-foreground">/{s.fields}</span></span>
          <span className="text-lg font-medium text-brand">{pct(ok, s.fields)}%</span>
          <span className="text-xs text-muted-foreground">fields</span>
        </div>
        <Progress value={pct(ok, s.fields)} className="h-1.5" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          <span><b className="text-navy">{s.correct}</b> correct</span>
          <span><b className="text-navy">{s.correct_abstention}</b> correct “unclear”</span>
          <span><b className={cn(s.wrong ? "text-lane-red" : "text-navy")}>{s.wrong}</b> wrong</span>
          <span><b className="text-navy">{s.wrong_abstention}</b> over-abstained</span>
          <span><b className={cn(s.missed_abstention ? "text-lane-amber" : "text-navy")}>{s.missed_abstention}</b> missed abstention</span>
        </div>
        {before?.s && (
          <div className="rounded-lg bg-surface p-2.5 text-xs text-navy">
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-medium">
              <span>{before.label}: {before.s.correct + before.s.correct_abstention}/{before.s.fields}</span>
              <span>v2 after design fixes: {ok}/{s.fields}</span>
            </div>
            <p className="mt-1 text-muted-foreground">{before.why}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SuiteCard({ s }: { s: SuiteResult }) {
  const icon =
    s.status === "skipped" ? <Badge variant="outline">skipped</Badge> : s.status === "pass" ? <CheckCircle2 className="size-5 text-lane-green" /> : s.status === "fail" ? <XCircle className="size-5 text-lane-red" /> : <Info className="size-5 text-brand" />;
  const rec = s.metrics.find((m) => m.label === "Recommendation");
  const metrics = s.metrics.filter((m) => m !== rec);
  return (
    <Card className="rounded-xl shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-navy">{s.title}{icon}</CardTitle>
        <p className="text-xs text-muted-foreground">Protects against: {s.protects}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {s.status === "skipped" ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDashed className="size-4" /> {s.note}</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-navy tabular-nums">{s.passed}<span className="text-base text-muted-foreground">/{s.total}</span></span>
            <span className="text-sm text-muted-foreground">{pct(s.passed, s.total)}%</span>
          </div>
        )}
        {metrics.length > 0 && (
          <dl className="space-y-1 text-xs">
            {metrics.map((m) => (
              <div key={m.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{m.label}</dt>
                <dd className="text-right font-medium text-navy tabular-nums">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {rec && <p className="rounded-lg bg-surface p-2 text-xs text-navy">{rec.value}</p>}
        {s.note && s.status !== "skipped" && <p className="text-[11px] text-muted-foreground">{s.note}</p>}
        {s.misses.length > 0 && (
          <details className="group rounded-lg border p-2 text-xs">
            <summary className="cursor-pointer font-medium text-navy">Misses ({s.misses.length})</summary>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {s.misses.map((m, i) => (
                <li key={i} className="border-t pt-1.5 first:border-0 first:pt-0">
                  <div className="font-medium text-navy">{m.item}</div>
                  <div className="text-muted-foreground">expected <span className="text-navy">{show(m.expected)}</span> · got <span className="text-lane-red">{show(m.got)}</span>{m.note ? ` · ${m.note}` : ""}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default async function Page() {
  const r = await getEvalResults();
  if (!r) {
    return <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-navy">No eval results yet. Run <code className="rounded bg-white px-1">npm run evals</code>.</div>;
  }
  const ORDER = ["heldout", "grouping", "citations", "abstention", "injection", "drafts", "stability", "calibration", "rules", "ops"];
  const suites = [...r.suites].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-navy">
        <span className="flex items-center gap-2"><FlaskConical className="size-4 text-brand" /> Dev scores reflect prompt tuning; held-out is the true estimate (v1 was the blind run). Small sets; counts shown.</span>
        <span className="text-xs text-muted-foreground">
          {r.models.extract} · drafts {r.models.draft} · run cost ${r.budget.spent_usd.toFixed(2)} of ${r.budget.limit_usd.toFixed(2)}
          {r.budget.skipped.length ? ` · skipped: ${r.budget.skipped.join("; ")}` : ""} · {r.generated_at.slice(0, 10)}
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Headline title="Dev (prompts tuned on this)" sub="10 suppliers × 17 fields, AI cache vs dev gold" s={r.headline.dev} />
        {r.previous ? (
          <Headline
            title="Held-out"
            sub="HO-01…HO-18 · v1 was blind; v2 re-measured after design fixes (no longer blind)"
            s={r.headline.heldout}
            before={{ label: r.previous.label, s: r.previous.headline.heldout, why: "What changed: drafts' terms are now extracted as non-binding proposed terms (HO-17 scored on them), review routing is evidence-based, and citations name the operative clause + “via”. No other tuning." }}
          />
        ) : (
          <Headline title="Held-out (untouched)" sub="HO-01…HO-18, run once with the current prompts" s={r.headline.heldout} />
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {suites.map((s) => <SuiteCard key={s.id} s={s} />)}
      </div>
      <Card className="rounded-xl shadow-soft">
        <CardHeader><CardTitle className="text-navy">Guardrails</CardTitle></CardHeader>
        <CardContent className="divide-y">
          {GUARDRAILS.map(([g, protects, a]) => (
            <div key={g} className="flex items-start gap-3 py-3">
              <ActorBadge actor={a} />
              <div>
                <div className="text-sm font-semibold text-navy">{g}</div>
                <div className="text-xs text-muted-foreground">Protects against: {protects}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
