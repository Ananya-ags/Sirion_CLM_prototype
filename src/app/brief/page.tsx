import { Activity, BookOpen, Compass, Cpu, DoorOpen, Gauge, Info, Lightbulb, Puzzle, ScrollText, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ActorBadge, Expandable, Hint, SourceChip } from "@/components/docket";
import { ProblemSection, type EvidenceRow } from "@/components/brief/ProblemSection";
import { SuccessMetrics } from "@/components/brief/SuccessMetrics";
import { ValueChain } from "@/components/brief/ValueChain";
import { TourButton } from "@/components/tour/TourButton";
import { getPortfolio } from "@/lib/portfolio";
import type { SupplierView } from "@/lib/seed";
import { CPI_INDIA_YOY_PCT, DEMO_TODAY_LABEL, FX, PERSONA_ORDER, PERSONAS } from "@/lib/config";
import { fullRunCost } from "@/lib/costs";
import { loadCache } from "@/lib/data";
import { EvalResultsSchema, type Score } from "@/lib/evals";
import { evalUnits, type Unit } from "@/lib/evalUnits";

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
  const [evals, cost, { views }] = await Promise.all([loadCache("eval_results", EvalResultsSchema.nullable(), null), fullRunCost(), getPortfolio()]);
  return { evals, fullRun: cost.usd, calls: cost.calls, evidence: evidenceRows(views), suppliers: views.length };
}

/** "Found in Velora's own data": every value from the rules engine output; "—" when unavailable. */
function evidenceRows(views: SupplierView[]): EvidenceRow[] {
  const v = (id: string) => views.find((x) => x.supplierId === id);
  const flag = (id: string, code: string) => v(id)?.flags.find((f) => f.code === code);
  const short = (id: string, fallback: string) => v(id)?.name.split(" ")[0] ?? fallback;
  const tw = v("SUP-09");
  const u1 = flag("SUP-01", "U1")?.data as { latest_active?: number; licensed_units?: number } | undefined;
  const conflicts = views.filter((x) => x.trackerConflicts.length);
  const n = conflicts.reduce((a, x) => a + x.trackerConflicts.length, 0);
  return [
    {
      supplier: short("SUP-09", "TalkWave"),
      href: tw ? "/contracts/SUP-09" : null,
      finding: `Silent renewal: no tracker row${tw?.actBy ? `, ${tw.actBy.daysToActBy} days to act-by` : ""}`,
      impactInr: tw && flag("SUP-09", "L4") ? tw.money.annualInr : null,
      impactSuffix: "/yr",
      lane: tw?.lane ?? null,
    },
    { supplier: short("SUP-01", "Nimbus"), href: "/contracts/SUP-01", finding: "Billing drift above contract", impactInr: flag("SUP-01", "L3")?.impactInr ?? null, lane: v("SUP-01")?.lane ?? null },
    {
      supplier: short("SUP-01", "Nimbus"),
      href: "/contracts/SUP-01",
      finding: `Unused seats${u1?.latest_active != null ? ` (${u1.latest_active}/${u1.licensed_units})` : ""}`,
      impactInr: flag("SUP-01", "U1")?.impactInr ?? null,
      impactSuffix: "/yr",
      lane: v("SUP-01")?.lane ?? null,
    },
    { supplier: short("SUP-01", "Nimbus"), href: "/contracts/SUP-01", finding: "Unclaimed SLA credit", impactInr: flag("SUP-01", "S1")?.impactInr ?? null, lane: v("SUP-01")?.lane ?? null },
    { supplier: short("SUP-10", "LearnLeap"), href: "/contracts/SUP-10", finding: "Paid after contract expiry", impactInr: flag("SUP-10", "L2")?.impactInr ?? null, lane: v("SUP-10")?.lane ?? null },
    {
      supplier: "Tracker",
      href: "/inbox",
      finding: `${n} conflicts (${conflicts.map((x) => x.name.split(" ")[0]).join(", ") || "none"})`,
      impactInr: null,
      lane: n ? "amber" : null,
    },
  ];
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

/** The handoff value chain (2 rows, AI / Rules / Human per step): see components/brief/ValueChain. */
function Flow() {
  return <ValueChain />;
}

function Num({ n, label, sub, tip, unit }: { n: string; label: string; sub?: string; tip?: string; unit?: Unit }) {
  return (
    <div className="rounded-xl border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="text-2xl font-semibold text-navy tabular-nums">{n}</span>
          {unit && n !== "—" && (
            <Hint content={unit.tip ? `${unit.caption}\n${unit.tip}` : unit.caption}>
              <span className="text-[0.8125rem] font-medium text-slate-500 underline decoration-slate-300 decoration-dotted underline-offset-2">{unit.short}</span>
            </Hint>
          )}
        </div>
        {tip && <Hint content={tip}><Info className="size-4 text-slate-400" /></Hint>}
      </div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

const PIPELINE: [string, string][] = [
  ["Group by legal IDs", "CIN / GSTIN / envelope IDs / parent references; never filenames"],
  ["Read PDF / OCR scans", "Text layer, or OCR for image-only scans"],
  ["Extract with quotes", "Every value carries a verbatim quote"],
  ["Verify quotes in code", "Quote not in the document → value becomes unclear"],
  ["Human review if needed", "OCR, unverified, unclear or missing key fields"],
  ["Draft around locked values", "Rules fix dates and ₹; AI writes wording only"],
];

export default async function Page() {
  const { evals, fullRun, calls, evidence, suppliers } = await getData();
  const suite = (id: string) => evals?.suites.find((s) => s.id === id);
  const metric = (id: string, label: string) => suite(id)?.metrics.find((m) => m.label === label)?.value ?? "—";
  const cit = suite("citations");
  const u = evals ? evalUnits(evals) : null;
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
          <div id="source" className="scroll-mt-24 rounded-xl border border-brand/20 bg-surface-2 p-5">
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
          <ProblemSection rows={evidence} suppliers={suppliers} />
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
          <SuccessMetrics />
        </Block>

        <Block id="evals" icon={Cpu} title="AI design & evals">
          <p className="-mt-2 text-sm text-slate-500">Tested on two sets: a dev set (the 10 demo suppliers, used to tune prompts) and a held-out test set (18 unseen clauses and contracts, kept untouched).</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Num n={score(evals?.previous?.headline.heldout ?? evals?.headline.heldout)} unit={u?.heldout} label="Held-out, v1 blind" sub="First run on unseen data; the honest score" tip="Run once before any changes. 13 of 14 misses came from one draft contract the pipeline skipped by design." />
            <Num n={evals?.previous ? score(evals.headline.heldout) : "—"} unit={u?.heldout} label="Held-out, v2" sub="Re-run after 2 design fixes" tip="Fixes: read drafts as non-binding context; route reviews on evidence, not confidence. No longer blind, so shown separately." />
            <Num n={suite("grouping") ? `${suite("grouping")!.passed}/${suite("grouping")!.total}` : "—"} unit={u?.grouping} label="Grouping (dev)" sub="Docs matched to the right supplier; look-alike decoy sent to review" />
            <Num n={cit ? String(cit.total - cit.passed) : "—"} label="Unverified citations" sub="Every quoted clause checked against the PDF text in code" tip={cit ? `${cit.passed} quotes checked` : undefined} />
            <Num n={suite("injection") ? `${suite("injection")!.passed}/${suite("injection")!.total}` : "—"} unit={u?.injection} label="Injection checks" sub="Hidden instructions in contracts were ignored" />
            <Num n={metric("drafts", "Live drafts")} unit={u?.drafts} label="Draft safety" sub="Live notices: no negotiation language, numbers match" />
            <Num n={`$${fullRun.toFixed(2)}`} label="Per full pipeline run" sub="Cost to read all 29 contracts once" tip={`${calls} calls: OCR, grouping, 10 extractions`} />
            <Num n={score(evals?.headline.dev)} unit={u?.dev} label="Dev set" sub="Prompts tuned on this, so optimistic" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PIPELINE.map(([c, t], i) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <Hint content={t}><span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-brand-strong">{c}</span></Hint>
                {i < PIPELINE.length - 1 && <span className="text-slate-400">→</span>}
              </span>
            ))}
          </div>
        </Block>

        <Block id="learned" icon={Lightbulb} title="What I learned">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["Confidence scores weren't reliable", "The AI was as accurate on low-confidence answers as on high ones, and its confident mistakes weren't flagged.", "Reviews are triggered by evidence (scans, unverified quotes, unclear clauses), not by the AI's own confidence."],
              ["Drafts are context, not contract", "Draft and redline copies contain different terms from the signed version.", "Drafts are shown side-by-side as non-binding and never change the terms Docket acts on."],
              ["Scanned contracts need a human check", "Scans have no text layer, so the AI must read the page images (OCR).", "OCR'd fields always go to a person to confirm before the contract's lane is set."],
            ].map(([t, d, so], i) => (
              <div key={t} className="rounded-xl border p-4">
                <div className="text-sm font-semibold text-brand">({String.fromCharCode(97 + i)})</div>
                <div className="text-base font-semibold text-navy">{t}</div>
                <p className="mt-1 text-sm">{d}</p>
                <p className="mt-1 text-sm"><b className="text-navy">So:</b> {so}</p>
              </div>
            ))}
          </div>
        </Block>

        <Expandable
          id="assumptions"
          className="scroll-mt-24 rounded-xl border bg-card px-6 py-4 shadow-soft"
          triggerClassName="py-2"
          contentClassName="pt-3 pb-2"
          title={<span className="flex items-center gap-2 text-xl font-semibold text-navy"><ScrollText className="size-5 text-brand" /> Assumptions</span>}
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Velora Consumer Pvt Ltd is fictional; all suppliers and documents are synthetic.</li>
            <li>Demo clock {DEMO_TODAY_LABEL}; USD→INR {FX.USD_INR}; India CPI {CPI_INDIA_YOY_PCT}% YoY.</li>
            <li>Internal decision target = act-by − 15 days; red at ≤ 14 days to act-by.</li>
            <li>Business-day notices skip weekends and Velora&apos;s Bengaluru holidays.</li>
            <li>Extraction is pre-computed by the AI pipeline; live AI runs for drafting.</li>
            <li>Sizing (₹320 Cr renewing unreviewed; ₹25–40 Cr avoidable) is an estimate.</li>
          </ul>
        </Expandable>
      </div>
    </div>
  );
}
