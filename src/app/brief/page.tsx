import { ArrowRight, BookOpen, Cpu, DoorOpen, Gauge, Map, Puzzle, ScrollText, ShieldAlert, Users } from "lucide-react";
import type { ReactNode } from "react";
import { ActorBadge } from "@/components/docket";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CPI_INDIA_YOY_PCT, DEMO_TODAY_LABEL, FX } from "@/lib/config";

const NAV = [
  ["why", "Why this stage"],
  ["stakeholders", "Stakeholders"],
  ["problem", "The problem"],
  ["prototype", "The prototype"],
  ["metrics", "Success metrics"],
  ["assumptions", "Assumptions"],
  ["pipeline", "AI pipeline"],
] as const;

const STAKEHOLDERS = [
  ["Budget owner", "Keep the service running with no admin", "Wants an easy renewal; Procurement wants leverage"],
  ["Procurement", "Act before act-by; control price creep", "Has 2,500 contracts and no CLM; can't read them all"],
  ["Finance / AP", "Pay only what the contract allows", "Pays invoices that nobody has matched to a contract"],
  ["Legal", "Notices that are valid, on time, correctly served", "Gets requests late, with no clause context"],
  ["CFO", "Predictable spend; no silent renewals", "Wants savings without slowing the business"],
  ["Supplier", "Auto-renewal, with an uplift", "Benefits when Velora misses the notice window"],
];

function Block({ id, icon: Icon, title, children }: { id: string; icon: typeof BookOpen; title: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 rounded-xl shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-navy"><Icon className="size-4 text-brand" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</CardContent>
    </Card>
  );
}

function Flow() {
  const steps: [string, "AI" | "Rules" | "owner" | "procurement" | "legal" | "finance", string][] = [
    ["System raises", "Rules", "Renewal found, request raised before act-by"],
    ["Rahul decides", "owner", "Renew / Exit / Send to Procurement"],
    ["Priya reviews", "procurement", "Decision card, evidence, drafts"],
    ["Meera approves", "legal", "Locked deadline, method, address"],
    ["Closed", "Rules", "Sent by a human, audit-logged"],
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-stretch gap-2">
        {steps.map(([t, a, d], i) => (
          <div key={t} className="flex items-center gap-2">
            <div className="w-40 rounded-xl border bg-surface p-3">
              <ActorBadge actor={a} />
              <div className="mt-1.5 text-sm font-semibold text-navy">{t}</div>
              <div className="text-[11px] text-muted-foreground">{d}</div>
            </div>
            {i < steps.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
          </div>
        ))}
      </div>
      <div className="inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 text-xs text-navy">
        <ActorBadge actor="finance" /> Akshat confirms billing alerts <ArrowRight className="size-3" /> evidence on Priya&apos;s card
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
      <nav className="sticky top-24 hidden h-fit space-y-1 lg:block">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-navy">{label}</a>
        ))}
      </nav>
      <div className="space-y-6">
        <Block id="why" icon={DoorOpen} title="1 · Why this stage: intake, triggered by renewal">
          <p className="text-lg font-semibold text-navy">“The riskiest request is the one never filed.”</p>
          <p>Contract intake usually waits for someone to ask. At Velora, the expensive requests are the ones nobody files: renewals that roll over on their own. Docket <b>raises intake requests itself</b> for existing contracts before their act-by date, so the 2,500-contract backlog passes through one guarded front door.</p>
          <p>New purchase requests use the same door later (v2); the UI shows that button disabled today.</p>
        </Block>

        <Block id="stakeholders" icon={Users} title="2 · Stakeholder map">
          <div className="grid gap-3 md:grid-cols-3">
            {STAKEHOLDERS.map(([who, wants, conflict]) => (
              <div key={who} className="rounded-xl border p-3">
                <div className="text-sm font-semibold text-navy">{who}</div>
                <div className="mt-1 text-xs"><span className="text-muted-foreground">Wants: </span>{wants}</div>
                <div className="mt-1 text-xs"><span className="text-muted-foreground">Tension: </span>{conflict}</div>
              </div>
            ))}
          </div>
        </Block>

        <Block id="problem" icon={ShieldAlert} title="3 · The problem">
          <p><b>Who:</b> Procurement, budget owners and AP at a 3,000-person consumer company with about ₹2,000 Cr of indirect spend, contracts scattered across SharePoint, inboxes and DocuSign, and an out-of-date tracker.</p>
          <p><b>Why it matters:</b> missed notice windows lock in uplifts for another term, invoices drift above contract, and expired contracts keep getting paid.</p>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["70%", "of tail-spend contracts renew without review", "Vertice, Q3 2026"],
              ["79%", "of IT leaders saw price increases at renewal", "Zylo 2026"],
              ["~16%", "SaaS inflation", "Vertice, Jun 2026"],
              ["8.6–11%", "of contract value leaks", "WorldCC estimate"],
            ].map(([n, t, s]) => (
              <div key={n} className="rounded-xl bg-hero-gradient p-4 text-white">
                <div className="text-2xl font-semibold">{n}</div>
                <div className="text-xs text-white/85">{t}</div>
                <div className="mt-1 text-[10px] text-white/60">{s}</div>
              </div>
            ))}
          </div>
          <p><b>Velora sizing (assumption):</b> about ₹320 Cr renews unreviewed each year; ₹25–40 Cr of that is avoidable.</p>
          <p><b>How we know it&apos;s real:</b> in the demo portfolio alone there is a silent renewal (TalkWave), billing drift (Nimbus +9%), payments after expiry (LearnLeap) and 4 tracker conflicts across 10 suppliers.</p>
        </Block>

        <Block id="prototype" icon={Puzzle} title="4 · The prototype">
          <Flow />
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["AI", "Classify documents, decide executed vs draft, link families, extract clauses with verbatim citations and confidence, write plain-language briefs and notice wording."],
              ["Rules", "Act-by dates (business days and holidays), every ₹ figure, FX, benchmarks, ledger checks, lanes, routing. Deterministic and tested against gold."],
              ["Human", "Low-confidence fields, owner decision, Procurement decision, Legal approval, and sending. Nothing external is ever automated."],
            ].map(([a, t]) => (
              <div key={a} className="rounded-xl border p-3">
                <ActorBadge actor={a as "AI" | "Rules" | "Human"} />
                <p className="mt-2 text-xs">{t}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-surface-2 p-3 text-sm font-medium text-navy">Negotiation boundary: Docket informs, routes and uses existing contract rights. Renegotiation is handed to Procurement.</div>
        </Block>

        <Block id="metrics" icon={Gauge} title="5 · Success metrics">
          <div className="rounded-xl bg-hero-gradient p-4 text-white">
            <div className="text-xs text-white/75">North star</div>
            <div className="text-base font-semibold">% of renewing contract value (next 120 days) with an active decision before act-by</div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border p-3"><div className="text-xs font-semibold text-navy">Inputs</div><ul className="mt-1 list-disc pl-4 text-xs"><li>Verified contract coverage</li><li>Time to decision</li><li>Review-queue burn-down</li></ul></div>
            <div className="rounded-xl border p-3"><div className="text-xs font-semibold text-navy">Guardrails</div><ul className="mt-1 list-disc pl-4 text-xs"><li>False auto-renew flags</li><li>Override rate</li><li>Extraction accuracy</li></ul></div>
            <div className="rounded-xl border p-3"><div className="text-xs font-semibold text-navy">Rethink if</div><ul className="mt-1 list-disc pl-4 text-xs"><li>Owners renew &gt;90% unchanged</li><li>Most act-by dates have passed when contracts are discovered</li><li>The review queue outgrows capacity</li></ul></div>
          </div>
        </Block>

        <Block id="assumptions" icon={ScrollText} title="Assumptions">
          <ul className="list-disc space-y-1 pl-4">
            <li>Velora Consumer Pvt Ltd is fictional; all suppliers and documents are synthetic.</li>
            <li>Demo clock fixed at {DEMO_TODAY_LABEL}; USD→INR {FX.USD_INR}; India CPI {CPI_INDIA_YOY_PCT}% YoY.</li>
            <li>Internal decision target = act-by − 15 days; red at ≤ 14 days to act-by.</li>
            <li>Business-day notices skip weekends and Velora&apos;s Bengaluru holiday list.</li>
            <li>Portfolio extraction is pre-computed by the AI pipeline (Claude reads the PDFs; every cited quote is verified in code; OCR and low-confidence fields go to human review); live AI is used for drafting.</li>
            <li>Velora sizing (₹320 Cr unreviewed, ₹25–40 Cr avoidable) is an estimate.</li>
          </ul>
        </Block>

        <Block id="pipeline" icon={Cpu} title="AI design and production pipeline">
          <ol className="list-decimal space-y-1 pl-4">
            <li><b>Grouping</b> by CIN / GSTIN / LLPIN / DocuSign envelope ID / parent-agreement cross-references, never folder or filename. A look-alike decoy (DOC-29) goes to human review, not to a supplier.</li>
            <li><b>PDF parsing + OCR</b> for scanned pages; strip running headers and footers before extraction.</li>
            <li><b>Extraction</b> with verbatim citations; “unclear” is a valid answer; document text is untrusted (injection-tested).</li>
            <li><b>Citation verification</b>: any quote not found in the source becomes “unclear” with 0 confidence.</li>
            <li><b>Human review</b> below 0.85 confidence; precedence by the latest executed amendment.</li>
            <li><b>Drafting</b> with locked values, a negotiation-boundary check and a numeric-fidelity check; template fallback marked “cached”.</li>
          </ol>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Map className="size-3" /> Today: steps 1–3 are pre-computed; steps 4–6 run live.</div>
        </Block>
      </div>
    </div>
  );
}
