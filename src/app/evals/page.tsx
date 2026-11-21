import { CheckCircle2, CircleDashed, FlaskConical, Info, XCircle } from "lucide-react";
import { ActorBadge, Hint } from "@/components/docket";
import { Badge } from "@/components/ui/badge";
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

function Big({ label, sub, s, tone }: { label: string; sub: string; s: Score | null; tone: "muted" | "brand" | "hero" }) {
  const ok = s ? s.correct + s.correct_abstention : 0;
  const hero = tone === "hero";
  return (
    <div className={cn("rounded-xl p-5", hero ? "bg-hero-gradient text-white shadow-lift" : "border bg-card shadow-soft")}>
      <div className={cn("text-base font-semibold", hero ? "text-white" : "text-navy")}>{label}</div>
      <div className={cn("text-xs", hero ? "text-white/80" : "text-slate-500")}>{sub}</div>
      {s ? (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[2.5rem] leading-none font-semibold tabular-nums">{ok}<span className={cn("text-xl", hero ? "text-white/70" : "text-slate-400")}>/{s.fields}</span></span>
            <span className={cn("text-xl font-semibold", hero ? "text-white" : tone === "brand" ? "text-brand" : "text-slate-500")}>{pct(ok, s.fields)}%</span>
          </div>
          <Hint content={`${s.correct} correct · ${s.correct_abstention} correct “unclear” · ${s.wrong} wrong · ${s.wrong_abstention} over-abstained · ${s.missed_abstention} missed abstention`}>
            <span className={cn("mt-1 inline-block text-xs underline decoration-dotted", hero ? "text-white/85" : "text-slate-500")}>{s.wrong} wrong · {s.missed_abstention} missed abstention</span>
          </Hint>
        </>
      ) : (
        <div className="mt-2 text-sm">not run</div>
      )}
    </div>
  );
}

function SuiteCard({ s }: { s: SuiteResult }) {
  const icon =
    s.status === "skipped" ? <Badge variant="outline">skipped</Badge> : s.status === "pass" ? <CheckCircle2 className="size-5 text-lane-green" /> : s.status === "fail" ? <XCircle className="size-5 text-lane-red" /> : <Info className="size-5 text-brand" />;
  const rec = s.metrics.find((m) => m.label === "Recommendation");
  const metrics = s.metrics.filter((m) => m !== rec);
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{s.title}</h3>
        {icon}
      </div>
      {s.status === "skipped" ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><CircleDashed className="size-4" /> {s.note}</p>
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-navy tabular-nums">{s.passed}<span className="text-base text-slate-400">/{s.total}</span></span>
          <span className="text-base text-slate-500">{pct(s.passed, s.total)}%</span>
        </div>
      )}
      <p className="mt-1 text-sm text-slate-600">{s.protects}</p>
      {rec && <p className="mt-3 rounded-lg bg-surface p-3 text-sm text-navy">{rec.value}</p>}
      {(metrics.length > 0 || s.misses.length > 0) && (
        <details className="group mt-3 rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium text-navy">Details{s.misses.length ? ` · ${s.misses.length} miss${s.misses.length > 1 ? "es" : ""}` : ""}</summary>
          {metrics.length > 0 && (
            <dl className="mt-2 space-y-1">
              {metrics.map((m) => (
                <div key={m.label} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{m.label}</dt>
                  <dd className="text-right font-medium text-navy tabular-nums">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {s.misses.length > 0 && (
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto border-t pt-2">
              {s.misses.map((m, i) => (
                <li key={i}>
                  <div className="font-medium text-navy">{m.item}</div>
                  <div className="text-xs text-slate-500">expected <span className="text-navy">{show(m.expected)}</span> · got <span className="text-lane-red">{show(m.got)}</span>{m.note ? ` · ${m.note}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </div>
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
    <div className="space-y-8">
      <section data-tour="evals-headline">
        <div className="grid gap-4 md:grid-cols-3">
          {r.previous && <Big label={`Held-out · ${r.previous.label}`} sub="the true estimate: run once, untouched" s={r.previous.headline.heldout} tone="brand" />}
          <Big label={r.previous ? "Held-out · v2 after design fixes" : "Held-out (untouched)"} sub={r.previous ? "draft scoping + evidence-based routing; no longer blind" : "run once with the current prompts"} s={r.headline.heldout} tone="hero" />
          <Big label="Dev set" sub="prompts tuned on this, so optimistic" s={r.headline.dev} tone="muted" />
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <FlaskConical className="size-4 text-brand" /> Dev scores reflect prompt tuning; held-out is the true estimate. Small sets; counts shown.
          <Hint content={`${r.models.extract} · drafts ${r.models.draft} · run cost $${r.budget.spent_usd.toFixed(2)} of $${r.budget.limit_usd.toFixed(2)}${r.budget.skipped.length ? ` · skipped: ${r.budget.skipped.join("; ")}` : ""} · ${r.generated_at.slice(0, 10)}`}>
            <span className="underline decoration-dotted">run details</span>
          </Hint>
        </p>
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {suites.map((s) => <SuiteCard key={s.id} s={s} />)}
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Guardrails</h2>
        <div className="flex flex-wrap gap-2">
          {GUARDRAILS.map(([g, protects, a]) => (
            <Hint key={g} content={`Protects against: ${protects}`}>
              <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-navy shadow-soft">
                <ActorBadge actor={a} /> {g}
              </span>
            </Hint>
          ))}
        </div>
      </section>
    </div>
  );
}
