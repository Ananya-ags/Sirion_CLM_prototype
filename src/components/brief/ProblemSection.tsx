import {
  ArrowRight,
  Ban,
  Building2,
  CalendarX,
  ExternalLink,
  FileSignature,
  FolderOpen,
  Info,
  IndianRupee,
  Layers,
  Lock,
  Receipt,
  RefreshCw,
  ShieldOff,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Hint } from "@/components/docket";
import { formatINRShort } from "@/lib/format";
import type { Lane } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One row of "Found in Velora's own data", computed from the rules engine (never hard-coded). */
export type EvidenceRow = { supplier: string; href: string | null; finding: string; impactInr: number | null; impactSuffix?: string; lane: Lane | null };

const LANE_DOT: Record<Lane, string> = { red: "bg-lane-red", amber: "bg-lane-amber", green: "bg-lane-green", needs_review: "bg-lane-review" };

function Sub({ icon: Icon, title, right, children }: { icon: LucideIcon; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-surface-2 pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-navy"><Icon className="size-5 text-brand" /> {title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

const FROM_CASE = <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.75rem] font-semibold text-brand-strong">From the case</span>;

export function ProblemSection({ rows, suppliers }: { rows: EvidenceRow[]; suppliers: number }) {
  const total = rows.reduce((n, r) => n + (r.impactInr ?? 0), 0);
  return (
    <div className="space-y-6">
      {/* A · Problem statement */}
      <div className="rounded-xl border-l-4 border-brand bg-surface-2 px-5 py-5">
        <p className="text-xl leading-snug font-bold tracking-tight text-navy">
          At Velora, signed contracts are filed and forgotten: no one owns the renewal moment, so contracts roll over on terms nobody re-checked.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            [Building2, "~2,500 suppliers"],
            [IndianRupee, "~₹2,000 Cr indirect spend"],
            [Ban, "No CLM"],
            [FolderOpen, "Contracts across SharePoint, mailboxes, DocuSign & a stale tracker"],
          ].map(([Icon, t]) => {
            const I = Icon as LucideIcon;
            return (
              <span key={t as string} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-soft">
                <I className="size-4 text-brand" /> {t as string}
              </span>
            );
          })}
        </div>
      </div>

      {/* B · How value leaks */}
      <Sub icon={TrendingUp} title="How value leaks">
        <ol className="grid grid-cols-2 gap-3 md:flex md:items-stretch md:gap-2">
          {[
            [FileSignature, "Contract signed"],
            [FolderOpen, "Filed across drives & inboxes; tracker goes stale"],
            [CalendarX, "Notice window passes unnoticed"],
            [RefreshCw, "Auto-renews, often with a price uplift"],
          ].map(([Icon, label], i, arr) => {
            const I = Icon as LucideIcon;
            const last = i === arr.length - 1;
            return (
              <li key={label as string} className="flex items-center gap-2 md:flex-1">
                <div className={cn("flex h-full w-full flex-col gap-2 rounded-xl border bg-white p-4 shadow-soft", last && "border-lane-red/40 bg-lane-red-bg/40")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("grid size-8 place-items-center rounded-full text-sm font-bold text-white", last ? "bg-lane-red" : "bg-brand")}>{i + 1}</span>
                    <I className={cn("size-5", last ? "text-lane-red" : "text-brand")} />
                  </div>
                  <span className="text-[0.9375rem] leading-snug font-medium text-slate-800">{label as string}</span>
                  {last && FROM_CASE}
                </div>
                {!last && <ArrowRight className="hidden size-5 shrink-0 text-slate-400 md:block" />}
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-500">Meanwhile, during the term:</span>
          {[
            [Receipt, "Invoices drift from agreed prices", true],
            [ShieldOff, "SLA credits go unclaimed", true],
            [Ban, "Expired contracts keep getting paid", false],
          ].map(([Icon, t, fromCase]) => {
            const I = Icon as LucideIcon;
            return (
              <span key={t as string} className="inline-flex items-center gap-1.5 rounded-full border border-lane-amber/50 bg-white px-3 py-1.5 text-sm font-medium text-slate-800">
                <I className="size-4 text-lane-amber" /> {t as string} {fromCase ? FROM_CASE : null}
              </span>
            );
          })}
        </div>
      </Sub>

      {/* C · What it costs */}
      <Sub icon={IndianRupee} title="What it costs Velora" right={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[0.8125rem] font-medium text-slate-500">Estimate · assumptions</span>}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          {[
            ["~₹800 Cr", "renews each year", "≈ 40% of ~₹2,000 Cr indirect spend comes up for renewal in a year."],
            ["~₹320 Cr", "renews unreviewed", "≈ 40% of renewing value rolls over with no review (industry: 70% of tail-spend contracts)."],
            ["₹25–40 Cr", "avoidable per year", "8–12% of the unreviewed value: uplifts above policy, unused seats, contracts no longer needed."],
          ].map(([n, label, working], i, arr) => {
            const last = i === arr.length - 1;
            return (
              <div key={n} className="flex items-center gap-2 sm:flex-1">
                <div className={cn("w-full rounded-xl border p-5 shadow-soft", last ? "border-brand/30 bg-surface-2" : "bg-white")}>
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("text-[1.875rem] leading-none font-semibold tabular-nums", last ? "text-brand" : "text-navy")}>{n}</span>
                    <Hint content={working}><Info className="size-4 text-slate-400" /></Hint>
                  </div>
                  <div className="mt-2 text-[0.9375rem] text-slate-800">{label}</div>
                </div>
                {!last && <ArrowRight className="hidden size-5 shrink-0 text-slate-400 sm:block" />}
              </div>
            );
          })}
        </div>
      </Sub>

      {/* D · How we know it's real */}
      <Sub icon={Target} title="How we know it's real">
        <div className="grid gap-4 min-[1400px]:grid-cols-[300px_1fr]">
          <div className="rounded-xl border bg-white p-4 shadow-soft">
            <div className="mb-3 text-[0.9375rem] font-semibold text-navy">Industry evidence</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["70%", "of tail-spend contracts renew without review", "Vertice, Q3 2026"],
                ["79%", "of IT leaders saw renewal price rises", "Zylo 2026"],
                ["~16%", "SaaS inflation", "Vertice, Jun 2026"],
                ["8.6–11%", "of contract value leaks", "WorldCC"],
              ].map(([n, t, s]) => (
                <div key={n} className="rounded-xl bg-hero-gradient p-3 text-white">
                  <div className="text-2xl font-semibold">{n}</div>
                  <div className="text-sm leading-snug text-white/90">{t}</div>
                  <div className="mt-1 text-xs text-white/65">{s}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-soft">
            <div className="mb-2 text-[0.9375rem] font-semibold text-navy">Found in Velora&apos;s own data (this demo)</div>
            <table className="w-full text-[0.9375rem]">
              <thead>
                <tr className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="py-2 pr-2">Supplier</th>
                  <th className="py-2 pr-2">What we found</th>
                  <th className="py-2 pr-2 text-right">Impact</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.supplier + r.finding} className="border-t">
                    <td className="py-2 pr-2 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 font-medium text-navy">
                        <span className={cn("size-2 rounded-full", r.lane ? LANE_DOT[r.lane] : "bg-slate-300")} />
                        {r.supplier}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-slate-800">{r.finding}</td>
                    <td className="py-2 pr-2 text-right font-semibold whitespace-nowrap text-navy tabular-nums">
                      {r.impactInr != null ? `${formatINRShort(r.impactInr)}${r.impactSuffix ?? ""}` : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {r.href && (
                        <Link href={r.href} aria-label={`Open ${r.supplier}`} className="text-slate-400 hover:text-brand"><ExternalLink className="size-4" /></Link>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-navy/15">
                  <td colSpan={2} className="pt-2.5 font-semibold text-navy">Identified in {suppliers} suppliers</td>
                  <td className="pt-2.5 text-right text-base font-bold whitespace-nowrap text-brand tabular-nums">{formatINRShort(total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[0.8125rem] text-slate-500">Computed by the rules engine from the contracts, ledger, tracker and reports.</p>
          </div>
        </div>
      </Sub>

      {/* E · Why fix it at renewal */}
      <Sub icon={RefreshCw} title="Why fix it at renewal">
        <div className="grid gap-2 min-[1400px]:grid-cols-3">
          {[
            [Lock, "Missed decisions compound", "Every renewal locks in the next 12–24 months."],
            [Target, "Cheapest point of leverage", "Before signature, a fix is a decision; after it, it's a dispute or a wait."],
            [Layers, "Whole backlog, one cycle", "~800 renewals a year put all 2,500 contracts through review."],
          ].map(([Icon, t, d]) => {
            const I = Icon as LucideIcon;
            return (
              <div key={t as string} className="rounded-xl border bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2"><I className="size-4.5 text-brand" /></span>
                  <span className="text-base leading-tight font-bold text-navy">{t as string}</span>
                </div>
                <p className="mt-2 text-[0.9375rem] leading-snug tracking-tight text-slate-800">{d as string}</p>
              </div>
            );
          })}
        </div>
        <a href="#source" className="mt-3 inline-flex text-sm font-medium text-brand hover:underline">See: Stopping the problem at its source ↑</a>
      </Sub>
    </div>
  );
}
