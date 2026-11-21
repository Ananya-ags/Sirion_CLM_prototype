/**
 * Draft notices that use rights ALREADY in the contract. Locked values are computed by Rules;
 * the LLM only writes wording around them. The template is the fallback ("cached").
 */
import { extractNumericTokens } from "./ai/guardrails";
import { DEMO_TODAY } from "./config";
import { formatDate, formatINR } from "./format";
import type { SupplierView } from "./seed";
import type { DraftKind, LockedValue } from "./types";

const v = <T,>(f: { value: T | "unclear" | null }) => (f.value === "unclear" ? null : f.value);
const METHOD: Record<string, string> = {
  email: "Email",
  email_or_physical: "Email or physical delivery",
  email_and_physical: "Email and physical delivery",
  registered_post: "Registered Post AD",
  physical_only: "Physical delivery only",
};

export function canDraft(view: SupplierView, kind: DraftKind): string | null {
  if (kind === "cap_letter") return view.flags.some((f) => f.code === "F3") ? null : "Cap letter needs an F3 (quote above contract cap).";
  if (v(view.terms.renewal_type) !== "auto" && v(view.terms.renewal_type) !== "evergreen") return "No renewal right to exercise (not auto/evergreen).";
  return null;
}

export function lockedValues(view: SupplierView, kind: DraftKind): LockedValue[] {
  const t = view.terms;
  const method = v(t.notice_method) ?? "unclear";
  const base: LockedValue[] = [
    { key: "date", label: "Letter date", value: formatDate(DEMO_TODAY) },
    { key: "notice_method", label: "Notice method", value: METHOD[method] ?? method },
    { key: "notice_address", label: "Address", value: String(v(t.notice_address) ?? "unclear") },
  ];
  if (kind === "exit_notice") {
    const deadline = view.actBy?.actBy ?? view.money.earliestExit;
    return [
      ...base,
      { key: "deadline", label: view.actBy ? "Serve by (act-by)" : "Effective exit", value: deadline ? formatDate(deadline) : "unclear" },
      { key: "term_end", label: "Term ends", value: v(t.initial_term_end) ? formatDate(String(v(t.initial_term_end))) : "unclear" },
      { key: "notice_days", label: "Notice period", value: `${v(t.notice_days) ?? "?"} ${v(t.notice_day_type) ?? ""} days`.replace(/\s+/g, " ") },
      { key: "clause", label: "Renewal clause", value: t.renewal_type.citation?.section ?? "unclear" },
      { key: "annual_value", label: "Annual value", value: formatINR(view.money.annualInr) },
    ];
  }
  const f3 = view.flags.find((f) => f.code === "F3")?.data as Record<string, number | string> | undefined;
  return [
    ...base,
    { key: "cap_pct", label: "Contract cap", value: `${f3?.cap_pct ?? "?"}%` },
    { key: "proposed_pct", label: "Quoted uplift", value: `${f3?.proposed_uplift_pct ?? "?"}%` },
    { key: "max_at_cap", label: "Max annual at cap", value: formatINR(Number(f3?.max_annual_at_cap_inr ?? 0)) },
    { key: "proposed_annual", label: "Quoted annual", value: formatINR(Number(f3?.proposed_annual_inr ?? 0)) },
    { key: "clause", label: "Cap clause", value: t.uplift.cap_pct.citation?.section ?? "unclear" },
    { key: "quote_ref", label: "Vendor quote", value: String(f3?.quote_doc ?? "") },
  ];
}

/** Every number/date/₹ in the locked values (the only ones a draft may contain). */
export function allowedValues(locked: LockedValue[]): (string | number)[] {
  return locked.flatMap((l) => extractNumericTokens(l.value).map((t) => t.value));
}

const get = (locked: LockedValue[], k: string) => locked.find((l) => l.key === k)?.value ?? "";

export function templateDraft(view: SupplierView, kind: DraftKind, locked: LockedValue[]): { subject: string; body: string } {
  const L = (k: string) => get(locked, k);
  if (kind === "exit_notice") {
    return {
      subject: `Notice of non-renewal: ${view.name}`,
      body: [
        `To: ${view.name}`,
        `Address: ${L("notice_address")}`,
        `Date: ${L("date")}`,
        ``,
        `Dear Sir or Madam,`,
        ``,
        `Velora Consumer Private Limited gives notice under clause ${L("clause")} of the agreement that it will not renew the agreement. The current term ends on ${L("term_end")}.`,
        ``,
        `This notice is given within the contractual notice period of ${L("notice_days")} and is served by ${L("notice_method")}. Please treat the agreement as ending on ${L("term_end")} and confirm receipt.`,
        ``,
        `Nothing in this notice waives any of Velora's rights under the agreement.`,
        ``,
        `For and on behalf of Velora Consumer Private Limited`,
        `Legal Counsel`,
      ].join("\n"),
    };
  }
  return {
    subject: `Renewal pricing must follow the contractual cap: ${view.name}`,
    body: [
      `To: ${view.name}`,
      `Address: ${L("notice_address")}`,
      `Date: ${L("date")}`,
      ``,
      `Dear Sir or Madam,`,
      ``,
      `We refer to your renewal quote (${L("quote_ref")}), which applies an uplift of ${L("proposed_pct")}, bringing the annual fee to ${L("proposed_annual")}.`,
      ``,
      `Clause ${L("clause")} of the agreement caps any renewal uplift at ${L("cap_pct")}. The renewal fee therefore cannot exceed ${L("max_at_cap")}. Please issue a corrected quote and invoice in line with the agreement.`,
      ``,
      `Nothing in this letter waives any of Velora's rights under the agreement.`,
      ``,
      `For and on behalf of Velora Consumer Private Limited`,
      `Legal Counsel`,
    ].join("\n"),
  };
}
