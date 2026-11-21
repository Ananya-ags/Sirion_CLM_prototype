import { Activity, ArrowRight, BookOpen, Compass, Cpu, DoorOpen, Gauge, Lightbulb, Puzzle, ScrollText, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ActorBadge, Hint, SourceChip } from "@/components/docket";
import { TourButton } from "@/components/tour/TourButton";
import { CPI_INDIA_YOY_PCT, DEMO_TODAY_LABEL, FX, PERSONA_ORDER, PERSONAS } from "@/lib/config";
import { fullRunCost } from "@/lib/costs";
import { loadCache } from "@/lib/data";
import { EvalResultsSchema, type Score } from "@/lib/evals";

const NAV = [
  ["howto", "How to use this"],
  ["why", "Why this stage"],
  ["stakeholders", "Stakeholders"],
  ["problem", "The problem"],
  ["prototype", "The prototype"],
  ["metrics", "Success metrics"],
  ["evals", "AI design & evals"],
  ["learned", "What I learned"],
  ["assumptions", "Assumptions"],
] as const;

const STAKEHOLDERS = [
  ["Budget owner", "Keep the service running, no admin", "Wants easy renewals; Procurement wants leverage"],
  ["Procurement", "Act before act-by; stop price creep", "2,500 contracts, no CLM, can't read them all"],
  ["Finance / AP", "Pay only what the contract allows", "Pays invoices nobody matched to a contract"],
  ["Legal", "Valid, on-time, correctly served notices", "Gets requests late, with no clause context"],
  ["CFO", "Predictable spend; no silent renewals", "Wants savings without slowing the business"],
  ["Supplier", "Auto-renewal, with an uplift", "Wins when Velora misses the notice window"],
];

async function getData() {
  "use cache";
  const [evals, cost] = await Promise.all([loadCache("eval_results", EvalResultsSchema.nullable(), null), fullRunCost()]);
  return { evals, fullRun: cost.usd, calls: cost.calls };
}

const score = (s: Score | null | undefined) => (s ? `${s.correct + s.correct_abstention}/${s.fields}` : "—");

function Block({ id, icon: Icon, title, children }: { id: string; icon: typeof BookOpen; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-xl border bg-card p-6 shadow-soft">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><Icon className="size-5 text-brand" /> {title}</h2>
      <div className="space-y-4 text-base leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function Flow() {
  const steps: [string, "Rules" | "owner" | "procurement" | "legal", string][] = [
    ["Docket raises", "Rules", "Renewal found before act-by"],
    ["Rahul decides", "owner", "Renew / Exit / Procurement"],
    ["Priya acts", "procurement", "Evidence, drafts, decision"],
    ["Meera approves", "legal", "Locked deadline & address"],
    ["Closed", "Rules", "Sent by a human, audited"],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-stretch gap-2">
        {steps.map(([t, a, d], i) => (
          <div key={t} className="flex items-center gap-2">
            <div className="w-44 rounded-xl border bg-surface p-3">
              <ActorBadge actor={a} />
              <div className="mt-1.5 text-base font-semibold text-navy">{t}</div>
              <div className="text-sm text-slate-600">{d}</div>
            </div>
            {i < steps.length - 1 && <ArrowRight className="size-5 text-slate-400" />}
          </div>
        ))}
      </div>
      <div className="inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-sm text-navy">
        <ActorBadge actor="finance" /> Akshat confirms billing alerts <ArrowRight className="size-4" /> evidence on Priya&apos;s card
      </div>
    </div>
  );
}

function Num({ n, label, sub }: { n: string; label: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <div className="text-2xl font-semibold text-navy tabular-nums">{n}</div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default async function Page() {
  const { evals, fullRun, calls } = await getData();
  const suite = (id: string) => evals?.suites.find((s) => s.id === id);
  const metric = (id: string, label: string) => suite(id)?.metrics.find((m) => m.label === label)?.value ?? "—";
  const cit = suite("citations");
  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
      <nav className="sticky top-28 hidden h-fit space-y-1 lg:block">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-surface hover:text-navy">{label}</a>
        ))}
      </nav>
      <div className="space-y-6">
        <section id="howto" data-tour="brief-howto" className="scroll-mt-24 rounded-xl border-2 border-brand/20 bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Compass className="size-5 text-brand" /> How to use this prototype</h2>
              <p className="mt-1 text-base text-slate-700">Switch employee at the top right. Each sees only their own screens; the state is shared.</p>
            </div>
            <TourButton />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PERSONA_ORDER.map((id) => (
              <div key={id} className="rounded-xl border bg-white p-4">
                <div className="text-base font-semibold text-navy">{PERSONAS[id].name}</div>
                <div className="text-sm text-slate-500">{PERSONAS[id].role}</div>
                <div className="mt-1 text-sm text-slate-700">{PERSONAS[id].does}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">For evaluators (sidebar): this guide, and Evals & Guardrails. “Reset” restores the demo.</p>
        </section>

        <Block id="why" icon={DoorOpen} title="1 · Why this stage: intake, triggered by renewal">
          <p className="text-lg font-semibold text-navy">“The riskiest request is the one never filed.”</p>
          <p>Renewals roll over unless someone acts, so nobody files them. Docket <b>raises the intake request itself</b> before act-by: existing contracts pass through one guarded front door. New purchases use the same door later (v2).</p>
          <div className="rounded-xl border border-brand/20 bg-surface-2 p-5">
            <div className="flex items-center gap-2 text-base font-semibold text-navy"><ShieldCheck className="size-5 text-brand" /> Stopping the problem at its source</div>
            <p className="mt-2 text-base leading-relaxed text-slate-800">
              Docket intervenes at the renewal decision point, before a contract rolls into another term. Every contract is reviewed when it comes up for renewal: contracts that should not continue are exited, and those that do renew continue only on reviewed terms. Addressing the problem at this point stops it at its source. It prevents the issues the case highlights (unreviewed auto-renewals, missed service levels, and invoices that do not match agreed prices) from carrying into the next contract term, rather than having to detect and recover them after the fact.
            </p>
          </div>
          <div className="rounded-xl border p-5">
            <div className="text-base font-semibold text-navy">Where Docket&apos;s data comes from</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <SourceChip source="sharepoint" label="Shared drives (SharePoint)" className="h-7 text-sm" />
              <SourceChip source="email" label="Shared mailboxes (email attachments)" className="h-7 text-sm" />
              <SourceChip source="docusign" label="DocuSign" className="h-7 text-sm" />
              <SourceChip source="tracker" label="Procurement Excel tracker" className="h-7 text-sm" />
              <SourceChip source="ledger" label="AP ledger (NetSuite)" className="h-7 text-sm" />
              <span className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-sm font-medium text-brand-strong">
                <Activity className="size-3.5" /> SLA &amp; usage reports
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Docket brings together contracts and trackers scattered across these sources, so each renewal is decided on one consolidated, verified view rather than on a single, often outdated spreadsheet. Personal inboxes are never scanned.
            </p>
          </div>
        </Block>

        <Block id="stakeholders" icon={Users} title="2 · Stakeholder map">
          <div className="grid gap-3 md:grid-cols-3">
            {STAKEHOLDERS.map(([who, wants, tension]) => (
              <Hint key={who} content={`Wants: ${wants}`}>
                <div className="rounded-xl border p-4">
                  <div className="text-base font-semibold text-navy">{who}</div>
                  <div className="mt-1 text-sm">{tension}</div>
                </div>
              </Hint>
            ))}
          </div>
        </Block>

        <Block id="problem" icon={ShieldAlert} title="3 · The problem">
          <p>Velora: ~2,500 suppliers, ~₹2,000 Cr indirect spend, contracts scattered across SharePoint, inboxes and DocuSign. Missed notice windows lock in uplifts; invoices drift; expired contracts keep getting paid.</p>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["70%", "of tail-spend contracts renew without review", "Vertice, Q3 2026"],
              ["79%", "of IT leaders saw renewal price rises", "Zylo 2026"],
              ["~16%", "SaaS inflation", "Vertice, Jun 2026"],
              ["8.6–11%", "of contract value leaks", "WorldCC estimate"],
            ].map(([n, t, s]) => (
              <div key={n} className="rounded-xl bg-hero-gradient p-4 text-white">
                <div className="text-2xl font-semibold">{n}</div>
                <div className="text-sm text-white/90">{t}</div>
                <div className="mt-1 text-xs text-white/65">{s}</div>
              </div>
            ))}
          </div>
          <p>In this demo alone: a silent renewal, billing drift, payment after expiry, an unclaimed SLA credit and 4 tracker conflicts.</p>
        </Block>

        <Block id="prototype" icon={Puzzle} title="4 · The prototype">
          <Flow />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["AI", "Reads PDFs (OCR for scans), groups documents, extracts terms with verbatim citations, writes notice wording."],
              ["Rules", "Act-by dates, every ₹ figure, FX, benchmarks, ledger and SLA checks, lanes, routing. Tested against gold."],
              ["Human", "Confirms OCR / unclear fields, decides, approves and sends. Nothing external is automated."],
            ].map(([a, t]) => (
              <div key={a} className="rounded-xl border p-4">
                <ActorBadge actor={a as "AI" | "Rules" | "Human"} />
                <p className="mt-2 text-sm">{t}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-surface-2 p-4 text-base font-medium text-navy">Negotiation boundary: Docket informs, routes and uses rights already in the contract. Renegotiation is handed to Procurement.</div>
        </Block>

        <Block id="metrics" icon={Gauge} title="5 · Success metrics">
          <div className="rounded-xl bg-hero-gradient p-4 text-white">
            <div className="text-sm text-white/80">North star</div>
            <div className="text-lg font-semibold">% of renewing contract value (next 120 days) with an active decision before act-by</div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Inputs", ["Verified contract coverage", "Time to decision", "Review-queue burn-down"]],
              ["Guardrails", ["False auto-renew flags", "Override rate", "Extraction accuracy"]],
              ["Rethink if", ["Owners renew >90% unchanged", "Act-by already passed at discovery", "Review queue outgrows capacity"]],
            ].map(([t, items]) => (
              <div key={t as string} className="rounded-xl border p-4">
                <div className="text-base font-semibold text-navy">{t}</div>
                <ul className="mt-1 list-disc pl-5 text-sm">{(items as string[]).map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
        </Block>

        <Block id="evals" icon={Cpu} title="AI design & evals">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Num n={score(evals?.previous?.headline.heldout ?? evals?.headline.heldout)} label="Held-out, v1 blind" sub="the honest estimate" />
            <Num n={evals?.previous ? score(evals.headline.heldout) : "—"} label="Held-out, v2" sub="after design fixes; no longer blind" />
            <Num n={suite("grouping") ? `${suite("grouping")!.passed}/${suite("grouping")!.total}` : "—"} label="Grouping (dev)" sub="0 wrong; decoy → review" />
            <Num n={cit ? String(cit.total - cit.passed) : "—"} label="Unverified citations" sub={cit ? `${cit.passed} quotes checked in code` : undefined} />
            <Num n={suite("injection") ? `${suite("injection")!.passed}/${suite("injection")!.total}` : "—"} label="Injection checks" />
            <Num n={metric("drafts", "Live drafts")} label="Draft safety" sub="boundary + numbers, live Haiku" />
            <Num n={`$${fullRun.toFixed(2)}`} label="Per full pipeline run" sub={`${calls} calls: OCR, grouping, 10 extractions`} />
            <Num n={score(evals?.headline.dev)} label="Dev set" sub="tuned on this" />
          </div>
          <p className="text-sm">Pipeline: group by legal identifiers → PDF text + OCR → cited extraction → quote check in code → evidence-based human review → drafting around locked values.</p>
        </Block>

        <Block id="learned" icon={Lightbulb} title="What I learned">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Confidence didn't predict errors", "Self-reported confidence missed the real mistakes, so review routing is evidence-based."],
              ["Drafts are context, not terms", "A redline is useful to compare against, but it never overrides executed terms."],
              ["Scans need two steps", "OCR gets the text; a human confirms the key fields before any lane is set."],
            ].map(([t, d], i) => (
              <div key={t} className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-brand">({String.fromCharCode(97 + i)})</div>
                <div className="text-base font-semibold text-navy">{t}</div>
                <p className="mt-1 text-sm">{d}</p>
              </div>
            ))}
          </div>
        </Block>

        <details id="assumptions" className="scroll-mt-24 rounded-xl border bg-card p-6 shadow-soft">
          <summary className="flex cursor-pointer items-center gap-2 text-xl font-semibold text-navy"><ScrollText className="size-5 text-brand" /> Assumptions</summary>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Velora Consumer Pvt Ltd is fictional; all suppliers and documents are synthetic.</li>
            <li>Demo clock {DEMO_TODAY_LABEL}; USD→INR {FX.USD_INR}; India CPI {CPI_INDIA_YOY_PCT}% YoY.</li>
            <li>Internal decision target = act-by − 15 days; red at ≤ 14 days to act-by.</li>
            <li>Business-day notices skip weekends and Velora&apos;s Bengaluru holidays.</li>
            <li>Extraction is pre-computed by the AI pipeline; live AI runs for drafting.</li>
            <li>Sizing (₹320 Cr renewing unreviewed; ₹25–40 Cr avoidable) is an estimate.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
