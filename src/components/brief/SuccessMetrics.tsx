import { Activity, Gauge, GitFork, RefreshCcw, Search, ShieldCheck, Timer, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Sub({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="border-t border-surface-2 pt-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-navy"><Icon className="size-5 text-brand" /> {title}</h3>
      {children}
    </div>
  );
}

const GROUPS: { label: string; rows: [string, string, string, string][] }[] = [
  {
    label: "Leading · adoption & flow",
    rows: [
      ["Verified coverage", "% of renewing ₹ with key terms verified", "≥80%", "Can't decide on what you can't see"],
      ["Time to decision", "Median days from request raised → decision", "≤10 days", "Leaves buffer before act-by"],
      ["Owner response rate", "% of owner requests answered before internal target", "≥85%", "Owner engagement is the main risk"],
      ["Auto-cleared share", "% of renewals in the green lane", "30–40%", "Proof that humans only see risky ones"],
    ],
  },
  {
    label: "Lagging · outcomes",
    rows: [
      ["₹ value protected", "Uplifts avoided + exits + seats right-sized + SLA credits recovered (vs quoted renewal price)", "Track monthly", "The business result"],
      ["Silent renewals", "Renewals that rolled over with no decision", "→ 0", "The case's core failure"],
    ],
  },
  {
    label: "Quality · guardrails",
    rows: [
      ["False flags", "Flags dismissed as wrong by Procurement / Finance", "<5%", "Trust in alerts"],
      ["Extraction accuracy", "Audited sample of key fields", "≥95%", "Decisions on correct terms"],
      ["Wrong-method notices", "Notices not sent per the contract's method / address", "0", "Legal validity"],
    ],
  },
];

const RETHINK: [string, string, string][] = [
  ["Owners renew >90% unchanged", "The brief isn't changing decisions", "Test a Procurement-led review for high-value renewals"],
  [">20% of act-by dates already passed when found", "Ingestion is too slow or incomplete", "Move capture upstream: continuous scanning + new-request intake (v2)"],
  ["The review queue grows faster than it's cleared", "Too many fields routed to humans", "Narrow key fields, improve OCR, batch confirmations"],
  ["₹ protected < cost of review time", "Thresholds are too low", "Raise auto-clear limits per category"],
];

const TH = "px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase";

/** "5 · Success metrics": north star, metric tree, targets table, rethink table. */
export function SuccessMetrics() {
  return (
    <div className="space-y-6">
      {/* A · North star */}
      <div className="rounded-xl bg-hero-gradient p-6 text-white shadow-lift">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white/80 uppercase"><Gauge className="size-4" /> North star</div>
        <div className="mt-1 text-xl leading-snug font-semibold">% of renewing contract value with an active decision before act-by</div>
        <div className="mt-2 rounded-lg bg-white/10 px-3 py-2 font-mono text-[0.8125rem] leading-relaxed text-white/90">
          ₹ value of renewals (next 120 days) decided by owner/Procurement before act-by ÷ total ₹ value of renewals due
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["Value-weighted: big contracts count more", "Captures coverage + timeliness", "Leading indicator of savings (₹ shows up later)"].map((c) => (
            <span key={c} className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">{c}</span>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Today ~30% (est.) → Target ≥90% within 2 quarters</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">Assumption</span>
          </div>
          <div className="relative mt-2 h-3 rounded-full bg-white/20" aria-label="Baseline 30%, target 90%">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: "30%" }} />
            <div className="absolute -top-1 h-5 w-0.5 bg-white" style={{ left: "90%" }} />
          </div>
          <div className="relative mt-1 h-4 text-xs text-white/80">
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: "30%" }}>30% today</span>
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: "90%" }}>90% target</span>
          </div>
        </div>
        <p className="mt-2 text-[0.8125rem] text-white/75">Measured from Docket&apos;s audit log: decision timestamp vs act-by date.</p>
      </div>

      {/* B · Metric tree */}
      <Sub icon={GitFork} title="Metric tree">
        <div className="flex flex-col items-center">
          <div className="rounded-xl border-2 border-brand/40 bg-surface-2 px-5 py-3 text-center text-base font-semibold text-navy">
            North star · % of renewing ₹ decided before act-by
          </div>
          <div className="h-5 w-0.5 bg-slate-300" aria-hidden />
          <div className="relative w-full">
            <div className="absolute top-0 right-[16.66%] left-[16.66%] h-0.5 bg-slate-300" aria-hidden />
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  [Search, "Coverage", "renewals found & verified"],
                  [Timer, "Speed", "time to decision"],
                  [ShieldCheck, "Quality", "decisions on correct data"],
                ] as const
              ).map(([Icon, t, d]) => (
                <div key={t} className="flex flex-col items-center">
                  <div className="h-5 w-0.5 bg-slate-300" aria-hidden />
                  <div className="w-full rounded-xl border bg-white p-4 text-center shadow-soft">
                    <Icon className="mx-auto size-5 text-brand" />
                    <div className="mt-1 text-base font-semibold text-navy">{t}</div>
                    <div className="text-[0.9375rem] text-slate-700">{d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Sub>

      {/* C · How we'll know it works */}
      <Sub icon={Activity} title="How we'll know it works">
        <div className="overflow-x-auto rounded-xl border bg-white shadow-soft">
          <table className="w-full min-w-[640px] text-[0.9375rem]">
            <thead>
              <tr className="border-b">
                <th className={TH}>Metric</th>
                <th className={TH}>Definition</th>
                <th className={cn(TH, "whitespace-nowrap")}>Target</th>
                <th className={TH}>Why it matters</th>
              </tr>
            </thead>
            {GROUPS.map((g) => (
              <tbody key={g.label}>
                <tr className="bg-surface">
                  <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold tracking-wide text-brand-strong uppercase">{g.label}</td>
                </tr>
                {g.rows.map(([m, d, t, w]) => (
                  <tr key={m} className="border-t align-top">
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-navy">{m}</td>
                    <td className="px-3 py-2.5 text-slate-800">{d}</td>
                    <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-brand tabular-nums">{t}</td>
                    <td className="px-3 py-2.5 text-slate-700">{w}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Sub>

      {/* D · What would make us rethink */}
      <Sub icon={RefreshCcw} title="What would make us rethink">
        <div className="overflow-x-auto rounded-xl border bg-white shadow-soft">
          <table className="w-full min-w-[600px] text-[0.9375rem]">
            <thead>
              <tr className="border-b">
                <th className={TH}>If we see</th>
                <th className={TH}>It likely means</th>
                <th className={TH}>We would</th>
              </tr>
            </thead>
            <tbody>
              {RETHINK.map(([see, means, would]) => (
                <tr key={see} className="border-t align-top first:border-t-0">
                  <td className="px-3 py-2.5 font-semibold text-navy">{see}</td>
                  <td className="px-3 py-2.5 text-slate-700">{means}</td>
                  <td className="px-3 py-2.5 text-slate-800">{would}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sub>
    </div>
  );
}
