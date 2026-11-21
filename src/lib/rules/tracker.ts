/** T1: Excel tracker vs effective contract terms (Rules). */
import { DEMO_TODAY } from "../config";
import type { TrackerRow } from "../types";
import { sameVendor } from "./ledger";

export type TrackerConflict = {
  field: string;
  tracker_value: string | number | null;
  contract_value: string | number | null;
  /** Where the contract value comes from, e.g. "DOC-11" (or "Rules"). */
  source: string;
};

export const findTrackerRow = (tracker: TrackerRow[], name: string) => tracker.find((t) => sameVendor(t.supplier_name, name)) ?? null;

export type TrackerTerms = {
  contractRef?: string | null;
  renewalType: string | null;
  termEnd: string | null;
  noticeDays: number | null;
  annualInr: number;
  sources: Partial<Record<"renewal_type" | "initial_term_end" | "notice_days" | "annual_value", string>>;
};

export function trackerConflicts(row: TrackerRow | null, t: TrackerTerms, today = DEMO_TODAY): TrackerConflict[] {
  if (!row) return [{ field: "(row)", tracker_value: null, contract_value: t.contractRef ?? "contract on file", source: "missing_from_tracker" }];
  const out: TrackerConflict[] = [];
  const src = (k: keyof TrackerTerms["sources"]) => t.sources[k] ?? "contract";
  if (t.termEnd && row.end_date !== t.termEnd) {
    out.push({ field: "end_date", tracker_value: row.end_date, contract_value: t.termEnd, source: src("initial_term_end") });
  }
  if (row.auto_renew !== "TBC" && t.renewalType && t.renewalType !== "unclear") {
    const contractRenews = t.renewalType === "auto" || t.renewalType === "evergreen";
    if ((row.auto_renew === "Y") !== contractRenews) {
      out.push({ field: "auto_renew", tracker_value: row.auto_renew, contract_value: t.renewalType, source: src("renewal_type") });
    }
  }
  if (row.notice_days != null && t.noticeDays != null && row.notice_days !== t.noticeDays) {
    out.push({ field: "notice_days", tracker_value: row.notice_days, contract_value: t.noticeDays, source: src("notice_days") });
  }
  if (row.annual_value_inr != null && row.annual_value_inr !== t.annualInr) {
    out.push({ field: "annual_value_inr", tracker_value: row.annual_value_inr, contract_value: t.annualInr, source: src("annual_value") });
  }
  const continuing = t.renewalType === "auto" || t.renewalType === "evergreen" || t.renewalType === "unclear";
  const status = continuing || (t.termEnd != null && t.termEnd >= today) ? "Active" : "Expired";
  if (row.status !== status) {
    out.push({ field: "status", tracker_value: row.status, contract_value: status, source: "Rules" });
  }
  return out;
}
