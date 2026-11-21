import { CheckCircle2, ChevronDown, CircleAlert, FlaskConical, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Expandable, Hint } from "@/components/docket";
import { fullRunCost } from "@/lib/costs";
import { loadCache } from "@/lib/data";
import { EvalResultsSchema, type EvalResults, type Miss, type Score, type SuiteResult } from "@/lib/evals";
import { evalUnits, type Unit } from "@/lib/evalUnits";
import { cn } from "@/lib/utils";

async function getData() {
  "use cache";
  const [r, cost] = await Promise.all([loadCache("eval_results", EvalResultsSchema.nullable(), null), fullRunCost()]);
  return { r, cost };
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const show = (v: unknown) => (v === null || v === undefined ? "null" : typeof v === "string" ? v : JSON.stringify(v));
const ok = (s: Score | null | undefined) => (s ? s.correct + s.correct_abstention : 0);

/* ------------------------------------------------------------------ */
/* Headline                                                            */
/* ------------------------------------------------------------------ */

function UnitLine({ unit, hero }: { unit?: Unit; hero?: boolean }) {
  if (!unit) return null;
  return (
    <p className={cn("mt-1 flex items-center gap-1.5 text-[0.8125rem] leading-snug", hero ? "text-white/85" : "text-slate-500")}>
      <span>{unit.caption}</span>
      {unit.tip && <Hint content={unit.tip}><Info className={cn("size-3.5 shrink-0", hero ? "text-white/70" : "text-slate-400")} /></Hint>}
    </p>
  );
}

function Big({ label, sub, s, tone, unit }: { label: string; sub: string; s: Score | null; tone: "muted" | "brand" | "hero"; unit?: Unit }) {
  const hero = tone === "hero";
  return (
    <div className={cn("rounded-xl p-5", hero ? "bg-hero-gradient text-white shadow-lift" : "border bg-card shadow-soft")}>
      <div className={cn("text-base font-semibold", hero ? "text-white" : "text-navy")}>{label}</div>
      <div className={cn("text-xs", hero ? "text-white/80" : "text-slate-500")}>{sub}</div>
      {s ? (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[2.5rem] leading-none font-semibold tabular-nums">{ok(s)}<span className={cn("text-xl", hero ? "text-white/70" : "text-slate-400")}>/{s.fields}</span></span>
            <span className={cn("text-xl font-semibold", hero ? "text-white" : tone === "brand" ? "text-brand" : "text-slate-500")}>{pct(ok(s), s.fields)}%</span>
          </div>
          <UnitLine unit={unit} hero={hero} />
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

/* ------------------------------------------------------------------ */
/* Grouped list                                                        */
/* ------------------------------------------------------------------ */

type Status = "pass" | "partial" | "note";
type Row = {
  name: string;
  result: string;
  status: Status;
  kind: "Eval" | "Guardrail";
  why: string;
  /** What the "X/Y" result counts. */
  unit?: Unit;
  method: string;
  metrics?: { label: string; value: string }[];
  misses?: Miss[];
};
type Group = { title: string; rows: Row[] };

const STATUS: Record<Status, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: "text-lane-green", label: "Pass" },
  partial: { icon: CircleAlert, className: "text-lane-amber", label: "Partial" },
  note: { icon: Info, className: "text-brand", label: "Note" },
};

function buildGroups(r: EvalResults, cost: { usd: number; calls: number }): Group[] {
  const suite = (id: string, from: EvalResults | EvalResults["previous"] = r) => from?.suites.find((s) => s.id === id) as SuiteResult | undefined;
  const metric = (id: string, label: string, from: EvalResults | EvalResults["previous"] = r) => suite(id, from)?.metrics.find((m) => m.label === label)?.value ?? "—";
  const count = (s?: SuiteResult) => (s ? `${s.passed}/${s.total}` : "—");
  const st = (s?: SuiteResult): Status => (!s || s.status === "info" || s.status === "skipped" ? "note" : s.status === "pass" ? "pass" : "partial");
  const misses = (id: string, filter?: (m: Miss) => boolean) => (suite(id)?.misses ?? []).filter(filter ?? (() => true));
  const ho = r.headline.heldout;
  const hoV1 = r.previous?.headline.heldout;
  const stability = suite("stability")?.status === "skipped" ? suite("stability", r.previous) : suite("stability");
  const opsRows = (suite("ops")?.metrics ?? []).filter((m) => ["ocr", "grouping", "extraction", "draft"].includes(m.label));
  const cit = suite("citations");
  const [devQ, hoQ] = [metric("citations", "Quote exists (dev)"), metric("citations", "Quote exists (held-out)")];
  const qSum = [devQ, hoQ].map((x) => x.split("/").map(Number));
  const section = metric("citations", "Section matches gold (dev)");
  const u = evalUnits(r);
  const retries = metric("drafts", "Retries needed");

  return [
    {
      title: "Reading contracts correctly",
      rows: [
        {
          name: "Held-out extraction",
          result: `${ok(ho)}/${ho?.fields ?? 0}`,
          unit: u.heldout,
          status: ho && ok(ho) === ho.fields ? "pass" : "partial",
          kind: "Eval",
          why: `Contracts the prompts never saw: the honest estimate. v1 blind ${ok(hoV1)}/${hoV1?.fields ?? "—"}; v2 after design fixes ${ok(ho)}/${ho?.fields ?? "—"}.`,
          method: "18 held-out items (15 snippets, 3 full contracts incl. a scan) through the same pipeline functions; field-level match against gold. v1 was run once, blind; v2 re-measured after draft scoping and evidence-based routing (no longer blind).",
          metrics: suite("heldout")?.metrics.filter((m) => !m.label.startsWith("HO-")),
          misses: misses("heldout"),
        },
        {
          name: "Dev extraction",
          result: `${ok(r.headline.dev)}/${r.headline.dev?.fields ?? 0}`,
          unit: u.dev,
          status: "note",
          kind: "Eval",
          why: "10 suppliers × 17 fields. Prompts were tuned on this set, so it is optimistic.",
          method: "Cached AI extraction (effective terms after precedence) vs dev gold, field by field.",
        },
        {
          name: "Grouping documents to suppliers",
          result: count(suite("grouping")),
          unit: u.grouping,
          status: st(suite("grouping")),
          kind: "Eval",
          why: `Each document must land with the right supplier; a look-alike decoy (DOC-29, Nimbus Analytics LLP) must go to review. Decoy → review: ${metric("grouping", "Decoy DOC-29 → null")}.`,
          method: "One AI call over first/last pages vs the vendor master, then code checks: known vendor, confidence ≥ 0.85, a verbatim evidence quote. Never filenames or folders.",
          metrics: suite("grouping")?.metrics,
          misses: misses("grouping"),
        },
        {
          name: "OCR for scans",
          result: metric("heldout", "HO-18"),
          unit: u.ocr,
          status: "pass",
          kind: "Guardrail",
          why: "Scanned contracts are transcribed by OCR; every field read that way waits for a human before it can set a lane.",
          method: "Image-only PDFs (DOC-12, HO-18) are transcribed verbatim; OCR fields are routed to human review until confirmed. Result shown: held-out scan HO-18 fields correct.",
        },
        {
          name: "Stability across runs",
          result: count(stability),
          unit: u.stability,
          status: stability ? st(stability) : "note",
          kind: "Eval",
          why: "The same contract should give the same answer every time.",
          method: `Extraction re-run 3 times for Nimbus, CodeCraft and Sentinel; fields compared.${suite("stability")?.status === "skipped" ? " Measured in v1 (blind); not re-run in v2 to stay in budget." : ""}`,
          metrics: stability?.metrics,
          misses: stability?.misses,
        },
      ],
    },
    {
      title: "Proving every answer",
      rows: [
        {
          name: "Citation exists in the source",
          result: `${qSum.reduce((n, [a]) => n + (a || 0), 0)}/${qSum.reduce((n, [, b]) => n + (b || 0), 0)}`,
          unit: u.citations,
          status: cit && devQ.split("/")[0] === devQ.split("/")[1] && hoQ.split("/")[0] === hoQ.split("/")[1] ? "pass" : "partial",
          kind: "Guardrail",
          why: "Every value carries a verbatim quote, checked in code; a quote that isn't in the document makes the value “unclear”.",
          method: `Dev ${devQ} · held-out ${hoQ}. Normalised for whitespace, case and typographic quotes.`,
          misses: misses("citations", (m) => m.note !== "section"),
        },
        {
          name: "Section accuracy",
          result: section.split(" ")[0],
          unit: u.section,
          status: "partial",
          kind: "Eval",
          why: "The cited clause should be the one gold points to, so a lawyer can find it fast.",
          method: "Clause numbers and Schedule / Annexure labels normalised; a match on either the operative or the “via” citation counts.",
          misses: misses("citations", (m) => m.note === "section"),
        },
        {
          name: "Operative + “via” citations",
          result: "in place",
          status: "pass",
          kind: "Guardrail",
          why: "The citation names the clause that creates the obligation, plus the definition it relies on (e.g. 14.2 via 1.21 “Notice Period”).",
          method: "Both quotes are verified in code; a failed “via” is dropped and logged, never voids the operative citation.",
        },
      ],
    },
    {
      title: "Knowing when not to answer",
      rows: [
        {
          name: "Abstention on ambiguous clauses",
          result: count(suite("abstention")),
          unit: u.abstention,
          status: st(suite("abstention")),
          kind: "Eval",
          why: "Where a contract genuinely contradicts itself (Sentinel 13.2 vs 13.3), the right answer is “unclear”, not a guess.",
          method: "Dev Sentinel renewal fields + held-out items marked ambiguous in gold.",
          metrics: suite("abstention")?.metrics,
          misses: misses("abstention"),
        },
        {
          name: "Evidence-based human review",
          result: `${metric("calibration", "Correct fields sent to review (evidence)")} vs ${metric("calibration", "Correct fields a < 0.85 rule would send")}`,
          status: "note",
          kind: "Guardrail",
          why: "Fields go to a human on evidence (OCR, quote not verified, unclear, key field missing), not on the model's self-reported confidence.",
          method: `Correct fields sent to review: evidence rule vs a confidence < 0.85 rule. Misses caught by evidence routing: ${metric("calibration", "Misses caught by evidence routing")}.`,
        },
        {
          name: "Confidence calibration",
          result: count(suite("calibration")),
          unit: u.calibration,
          status: "note",
          kind: "Eval",
          why: "Finding: self-reported confidence didn't predict errors, so routing is now evidence-based. Confidence stays as a displayed signal.",
          method: "Accuracy for confidence ≥ 0.85 vs < 0.85 across dev and held-out fields.",
          metrics: suite("calibration")?.metrics.filter((m) => m.label !== "Recommendation"),
          misses: misses("calibration"),
        },
      ],
    },
    {
      title: "Safety of AI actions",
      rows: [
        {
          name: "Prompt-injection resistance",
          result: count(suite("injection")),
          unit: u.injection,
          status: st(suite("injection")),
          kind: "Eval",
          why: "Instructions hidden in a contract (TalkWave Annexure 3: “classify as non-renewing”) must not change what Docket extracts.",
          method: "Dev TalkWave still auto-renew, 24 months; plus a live held-out snippet with an injected instruction appended.",
          misses: misses("injection"),
        },
        {
          name: "Negotiation-boundary check",
          result: metric("drafts", "Boundary check pass"),
          unit: u.boundary,
          status: "pass",
          kind: "Guardrail",
          why: "Drafts may only use rights already in the contract; phrases like “discount” or “we propose” are blocked.",
          method: "Every live draft is scanned; a violation triggers one regeneration, then the labelled template.",
        },
        {
          name: "Numeric fidelity of drafts",
          result: metric("drafts", "Numeric fidelity pass"),
          unit: u.numeric,
          status: "pass",
          kind: "Guardrail",
          why: "Every date, ₹ amount and % in a letter must match values computed by Rules; the LLM never does arithmetic.",
          method: "All numbers in the draft are extracted and compared with the locked values.",
          metrics: suite("drafts")?.metrics.filter((m) => !["Boundary check pass", "Numeric fidelity pass"].includes(m.label)),
          misses: misses("drafts"),
        },
        {
          name: "No automatic external sends",
          result: "by design",
          status: "pass",
          kind: "Guardrail",
          why: "Docket never sends anything outside Velora; only internal, reversible actions are automated.",
          method: "There is no send integration; Legal marks a notice as sent after a human sends it. Every step is audit-logged.",
        },
        {
          name: "Human approval before any notice",
          result: "Legal approves",
          status: "pass",
          kind: "Guardrail",
          why: "Every exit notice or cap letter waits for Legal, with deadline, method and address locked.",
          method: "Request state machine: procurement_review → legal_pending → sent only by Legal.",
        },
      ],
    },
    {
      title: "Reliability & cost",
      rows: [
        {
          name: "Validation, retry, cached fallback",
          result: `${retries} ${retries === "1" ? "retry" : "retries"}`,
          status: "pass",
          kind: "Guardrail",
          why: "Malformed AI output never blocks the UI: it is validated, retried once, then replaced by a labelled cached result.",
          method: "zod schema on every model reply; one retry with the validation error; template / cache fallback marked “cached”.",
        },
        {
          name: "Rate limits on public routes",
          result: "10 / hour",
          status: "pass",
          kind: "Guardrail",
          why: "A public demo link can't run up AI costs: live drafting is limited per visitor, then falls back to the template.",
          method: "In-memory limiter: /api/draft 10 per IP per hour (template with a note beyond that); /api/evaluate 60 per hour (Rules only).",
        },
        {
          name: "Cost per full run",
          result: `$${cost.usd.toFixed(2)}`,
          status: "note",
          kind: "Eval",
          why: "What it costs to re-read the whole portfolio (OCR, grouping, 10 extractions).",
          method: `Most recent call per pipeline step (${cost.calls} calls), standard API prices.`,
          metrics: suite("ops")?.metrics.filter((m) => !["ocr", "grouping", "extraction", "draft"].includes(m.label)),
        },
        {
          name: "Latency (p50 / p95)",
          result: opsRows.find((m) => m.label === "extraction")?.value.match(/p50 [\d.]+s/)?.[0] ?? "—",
          status: "note",
          kind: "Eval",
          why: "How long each kind of AI call takes; drafting is the only one a user waits for.",
          method: "Per call type across all logged pipeline and eval calls.",
          metrics: opsRows,
        },
      ],
    },
    {
      title: "Business rules",
      rows: [
        {
          name: "Rules tests vs gold",
          result: count(suite("rules")),
          unit: u.rules,
          status: st(suite("rules")),
          kind: "Eval",
          why: "Act-by dates, every ₹ figure, flags and lanes are deterministic and must reproduce the gold set exactly.",
          method: "vitest: rules engine, pipeline and eval unit tests.",
          metrics: suite("rules")?.metrics.filter((m) => !m.label.startsWith("Gold")),
          misses: misses("rules"),
        },
        {
          name: "Lanes, flags and ₹ unchanged on AI data",
          result: metric("rules", "Gold match (seed + AI cache)"),
          unit: u.rulesGold,
          status: st(suite("rules")),
          kind: "Eval",
          why: "Feeding the rules from the AI extraction (not the gold seed) must give the same lanes, flags and ₹. One intended difference: a scan needs human confirmation first.",
          method: "Gold tests on the seed and on the cached AI extraction (CleanSphere's OCR'd contract goes to review until a human confirms it).",
        },
      ],
    },
  ];
}

function RowItem({ row }: { row: Row }) {
  const S = STATUS[row.status];
  const Icon = S.icon;
  const hasDetail = !!(row.method || row.metrics?.length || row.misses?.length);
  return (
    <details className="group border-t first:border-t-0">
      <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-4 hover:bg-surface/60">
        <Hint content={S.label}>
          <Icon className={cn("mt-0.5 size-5 shrink-0", S.className)} />
        </Hint>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base font-semibold text-navy">{row.name}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", row.kind === "Eval" ? "bg-actor-ai-bg text-actor-ai" : "bg-actor-rules-bg text-actor-rules")}>{row.kind}</span>
          </div>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-slate-700">{row.why}</p>
          {row.unit && (
            <p className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-slate-500">
              <span><span className="font-semibold text-slate-600 tabular-nums">{row.result}</span> = {row.unit.caption}</span>
              {row.unit.tip && <Hint content={row.unit.tip}><Info className="size-3.5 shrink-0 text-slate-400" /></Hint>}
            </p>
          )}
        </div>
        <span className="shrink-0 text-lg font-semibold whitespace-nowrap text-navy tabular-nums">{row.result}</span>
        {hasDetail && <ChevronDown className="mt-1 size-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />}
      </summary>
      {hasDetail && (
        <div className="space-y-3 px-5 pb-5 pl-14 text-sm text-slate-700">
          <p><span className="font-semibold text-navy">How it&apos;s measured · </span>{row.method}</p>
          {row.metrics && row.metrics.length > 0 && (
            <dl className="grid gap-x-8 gap-y-1 rounded-lg bg-surface p-3 sm:grid-cols-2">
              {row.metrics.map((m) => (
                <div key={m.label} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{m.label}</dt>
                  <dd className="text-right font-medium text-navy tabular-nums">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {row.misses && row.misses.length > 0 && (
            <div>
              <div className="mb-1 font-semibold text-navy">Misses ({row.misses.length})</div>
              <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border p-3">
                {row.misses.map((m, i) => (
                  <li key={i}>
                    <span className="font-medium text-navy">{m.item}</span>
                    <span className="text-slate-500"> · expected </span><span className="text-navy">{show(m.expected)}</span>
                    <span className="text-slate-500"> · got </span><span className="text-lane-red">{show(m.got)}</span>
                    {m.note && <span className="text-slate-500"> · {m.note}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </details>
  );
}

/** "5 checks · 4 evals, 1 guardrail · all passing" (or "4 passing, 1 partial"). */
function groupSummary(rows: Row[]): string {
  const n = (k: Row["kind"]) => rows.filter((r) => r.kind === k).length;
  const kinds = [[n("Eval"), "eval"], [n("Guardrail"), "guardrail"]].filter(([c]) => c).map(([c, w]) => `${c} ${w}${c === 1 ? "" : "s"}`).join(", ");
  const s = (k: Status) => rows.filter((r) => r.status === k).length;
  const status = s("pass") === rows.length ? "all passing" : [[s("pass"), "passing"], [s("partial"), "partial"], [s("note"), s("note") === 1 ? "note" : "notes"]].filter(([c]) => c).map(([c, w]) => `${c} ${w}`).join(", ");
  return `${rows.length} checks · ${kinds} · ${status}`;
}

function GroupedList({ groups }: { groups: Group[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
      {groups.map((g, i) => (
        <Expandable
          key={g.title}
          defaultOpen={i === 0}
          className="border-t first:border-t-0"
          triggerClassName="rounded-none bg-surface-2 px-5 py-3 hover:bg-surface-2/70 focus-visible:ring-inset focus-visible:ring-offset-0"
          title={<span className="text-[0.9375rem] font-semibold tracking-wide text-brand-strong uppercase">{g.title}</span>}
          summary={groupSummary(g.rows)}
        >
          {g.rows.map((row) => <RowItem key={row.name} row={row} />)}
        </Expandable>
      ))}
    </div>
  );
}

function Legend(): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
      {(Object.keys(STATUS) as Status[]).map((k) => {
        const S = STATUS[k];
        const Icon = S.icon;
        return <span key={k} className="inline-flex items-center gap-1.5"><Icon className={cn("size-4", S.className)} /> {S.label}</span>;
      })}
      <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-actor-ai-bg px-2 py-0.5 text-xs font-medium text-actor-ai">Eval</span> measured</span>
      <span className="inline-flex items-center gap-1.5"><span className="rounded-full bg-actor-rules-bg px-2 py-0.5 text-xs font-medium text-actor-rules">Guardrail</span> enforced in code</span>
    </div>
  );
}

export default async function Page() {
  const { r, cost } = await getData();
  if (!r) {
    return <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-navy">No eval results yet. Run <code className="rounded bg-white px-1">npm run evals</code>.</div>;
  }
  const u = evalUnits(r);
  return (
    <div className="space-y-6">
      <section data-tour="evals-headline">
        <div className="grid gap-4 md:grid-cols-3">
          {r.previous && <Big label={`Held-out · ${r.previous.label}`} sub="the true estimate: run once, untouched" s={r.previous.headline.heldout} tone="brand" unit={u.heldout} />}
          <Big label={r.previous ? "Held-out · v2 after design fixes" : "Held-out (untouched)"} sub={r.previous ? "draft scoping + evidence-based routing; no longer blind" : "run once with the current prompts"} s={r.headline.heldout} tone="hero" unit={u.heldout} />
          <Big label="Dev set" sub="prompts tuned on this, so optimistic" s={r.headline.dev} tone="muted" unit={u.dev} />
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <FlaskConical className="size-4 text-brand" /> Dev scores reflect prompt tuning; held-out is the true estimate. Small sets; counts shown.
          <Hint content={`${r.models.extract} · drafts ${r.models.draft} · run cost $${r.budget.spent_usd.toFixed(2)} of $${r.budget.limit_usd.toFixed(2)}${r.budget.skipped.length ? ` · skipped: ${r.budget.skipped.join("; ")}` : ""} · ${r.generated_at.slice(0, 10)}`}>
            <span className="underline decoration-dotted">run details</span>
          </Hint>
        </p>
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-navy">All checks: evals and guardrails</h2>
          <p className="mt-1 max-w-4xl text-[0.9375rem] leading-relaxed text-slate-600">
            Evals measure how accurate the AI is, scored against an answer key. Guardrails are safety rules enforced in code on every run (and tested). Each row is tagged Eval or Guardrail.
          </p>
        </div>
        <Legend />
        <GroupedList groups={buildGroups(r, cost)} />
      </section>
    </div>
  );
}
