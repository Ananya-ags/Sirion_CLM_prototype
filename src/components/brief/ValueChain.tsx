import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { ActorBadge } from "@/components/docket";
import { cn } from "@/lib/utils";

type Tag = { kind: "informs" | "reversible" | "human"; text: string };
type Step = { n?: number; title: string; who: string; ai: string; rules: string; human: string; tag: Tag; side?: boolean };

const STEPS: Step[] = [
  {
    n: 1,
    title: "Renewal found before act-by date",
    who: "Docket (system)",
    ai: "Reads contracts across sources, groups documents, extracts terms with verified quotes",
    rules: "Computes act-by dates and ₹, checks ledger and SLAs, assigns the lane",
    human: "None yet; unclear or scanned fields go to review",
    tag: { kind: "reversible", text: "Acts (reversible) · raises the request; auto-logs only clean green renewals" },
  },
  {
    n: 2,
    title: "Owner decides",
    who: "Rahul · Budget Owner",
    ai: "Summarises findings in plain language (informs only)",
    rules: "Pre-fills spend, seats used, price rise",
    human: "Answers 2 questions; chooses Renew / Exit / Send to Procurement",
    tag: { kind: "human", text: "Human acts" },
  },
  {
    n: 3,
    title: "Procurement reviews",
    who: "Priya · Procurement Lead",
    ai: "Drafts the exit notice or cap letter from locked values (no new terms)",
    rules: "Assembles evidence; guardrails check numbers and negotiation language",
    human: "Confirms the decision; hands renegotiation off (out of scope)",
    tag: { kind: "human", text: "Human acts" },
  },
  {
    n: 4,
    title: "Legal approves",
    who: "Meera · Legal Counsel",
    ai: "No action; the draft is read-only",
    rules: "Deadline, notice method and address locked",
    human: "Approves and marks the notice as sent",
    tag: { kind: "human", text: "Human acts · nothing is sent automatically" },
  },
  {
    n: 5,
    title: "Closed & audited",
    who: "Docket (system)",
    ai: "—",
    rules: "Closes the request; every step in the audit trail",
    human: "Can reopen; confirmed corrections re-run the rules",
    tag: { kind: "informs", text: "Informs only" },
  },
];

const AKSHAT: Step = {
  title: "Billing checks",
  who: "Akshat · Finance / AP",
  ai: "—",
  rules: "Flags billing drift, payment after expiry, unclaimed SLA credits",
  human: "Confirms or dismisses; confirmed items attach as evidence to Priya's card",
  tag: { kind: "human", text: "Human acts" },
  side: true,
};

const TAG: Record<Tag["kind"], string> = {
  informs: "bg-slate-100 text-slate-600",
  reversible: "bg-surface-2 text-brand-strong",
  human: "bg-navy text-white",
};

function Card({ s }: { s: Step }) {
  return (
    <div className={cn("flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-white shadow-soft", s.side && "border-2 border-dashed border-brand/40")}>
      <div className="flex items-start gap-2.5 bg-surface-2 px-4 py-3">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white", s.side ? "bg-slate-400" : "bg-brand")}>{s.n ?? "+"}</span>
        <div className="min-w-0">
          <div className="text-[1.0625rem] leading-snug font-semibold text-navy">{s.title}</div>
          <div className="text-sm font-medium text-slate-700">{s.who}</div>
        </div>
      </div>
      <dl className="flex-1 space-y-2 px-4 py-3">
        {(
          [
            ["AI", s.ai],
            ["Rules", s.rules],
            ["Human", s.human],
          ] as const
        ).map(([a, t]) => (
          <div key={a} className="grid grid-cols-[76px_1fr] items-start gap-2">
            <dt className="pt-0.5"><ActorBadge actor={a} /></dt>
            <dd className={cn("text-[0.9375rem] leading-snug", t === "—" ? "text-slate-400" : "text-slate-800")}>{t}</dd>
          </div>
        ))}
      </dl>
      <div className="px-4 pb-3">
        <span className={cn("inline-block rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold", TAG[s.tag.kind])}>{s.tag.text}</span>
      </div>
    </div>
  );
}

const Arrow = () => (
  <div className="flex items-center justify-center" aria-hidden>
    <ArrowRight className="size-5 text-slate-400" />
  </div>
);

/** Connector from the end of one row back to the start of the next (an L-shaped line with a down arrow). */
function Wrap({ cols, evidenceCol }: { cols: 2 | 3; evidenceCol?: boolean }) {
  // percentages of the row width where the line starts (last card's centre) and ends (first card's centre)
  const end = cols === 3 ? "16.5%" : "25%";
  const start = cols === 3 ? "16.5%" : "25%";
  return (
    <div className="relative h-12" aria-hidden>
      <div className="absolute top-0 h-6 rounded-br-lg border-r-2 border-b-2 border-slate-300" style={{ right: end, left: "50%" }} />
      <div className="absolute top-6 h-0 border-b-2 border-slate-300" style={{ left: start, right: "50%" }} />
      <div className="absolute top-6 flex h-6 flex-col items-center" style={{ left: `calc(${start} - 10px)` }}>
        <ArrowDown className="size-5 text-slate-400" />
      </div>
      {evidenceCol && (
        <div className="absolute top-0 flex h-12 items-center gap-1 text-[0.8125rem] font-medium text-brand" style={{ right: "4%" }}>
          <span className="h-full border-l-2 border-dashed border-brand/50" />
          <ArrowUp className="size-4" /> evidence → Priya
        </div>
      )}
    </div>
  );
}

/** The 2-row value chain for "4 · The prototype". */
export function ValueChain() {
  const [s1, s2, s3, s4, s5] = STEPS;
  return (
    <div className="space-y-3">
      {/* Wide: rows of 3 (1-2-3 / 4-5-Akshat) */}
      <div className="hidden min-[1400px]:block">
        <div className="grid grid-cols-[1fr_28px_1fr_28px_1fr] items-stretch">
          <Card s={s1} /><Arrow /><Card s={s2} /><Arrow /><Card s={s3} />
        </div>
        <Wrap cols={3} evidenceCol />
        <div className="grid grid-cols-[1fr_28px_1fr_28px_1fr] items-stretch">
          <Card s={s4} /><Arrow /><Card s={s5} /><div /><Card s={AKSHAT} />
        </div>
      </div>
      {/* Narrower: rows of 2 (1-2 / 3-4 / 5-Akshat) */}
      <div className="min-[1400px]:hidden">
        <div className="grid grid-cols-[1fr_28px_1fr] items-stretch"><Card s={s1} /><Arrow /><Card s={s2} /></div>
        <Wrap cols={2} />
        <div className="grid grid-cols-[1fr_28px_1fr] items-stretch"><Card s={s3} /><Arrow /><Card s={s4} /></div>
        <Wrap cols={2} />
        <div className="grid grid-cols-[1fr_28px_1fr] items-stretch"><Card s={s5} /><div /><Card s={{ ...AKSHAT, title: "Billing checks · evidence → Priya (step 3)" }} /></div>
      </div>
      <p className="text-[0.9375rem] font-medium text-navy">AI reads and drafts · Rules compute and route · Humans decide and send. Docket never negotiates.</p>
    </div>
  );
}
