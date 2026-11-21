/** Deterministic guardrails applied to every LLM output (no LLM involved). */
import type { Field } from "../types";

/* ------------------------------------------------------------------ */
/* 1. Citations must exist in the source text                          */
/* ------------------------------------------------------------------ */

export function normaliseText(s: string): string {
  return s
    .normalize("NFKC")
    // Markdown punctuation (table pipes, **bold**, `code`) never appears in a PDF's text layer.
    .replace(/[|*`]/g, " ")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True if the quote appears in the document after normalising whitespace, case and typographic quotes/dashes. */
export function verifyQuote(docText: string, quote: string | null | undefined): boolean {
  if (!quote || !quote.trim()) return false;
  return normaliseText(docText).includes(normaliseText(quote));
}

/** A value whose quote can't be found becomes "unclear" with confidence 0 (citation kept for the audit trail). */
export function applyQuoteCheck<T>(field: Field<T>, docText: string): Field<T> {
  if (field.value === null || field.value === "unclear") return field;
  if (field.citation && verifyQuote(docText, field.citation.quote)) return field;
  return { ...field, value: "unclear", confidence: 0 };
}

/* ------------------------------------------------------------------ */
/* 2. Numeric fidelity: every number/₹/date in a draft must be allowed */
/* ------------------------------------------------------------------ */

export type NumericToken = { raw: string; kind: "date" | "money" | "percent" | "number"; value: string | number };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const iso = (y: string | number, m: number, d: string | number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const monthNum = (m: string) => MONTHS.indexOf(m.slice(0, 3).toLowerCase()) + 1;
const UNIT: Record<string, number> = { l: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 };
const num = (s: string) => Number(s.replace(/,/g, ""));
const round = (n: number) => Math.round(n * 1e6) / 1e6;

type Rule = { re: RegExp; kind: NumericToken["kind"]; value: (m: RegExpExecArray) => string | number };

const RULES: Rule[] = [
  // Reference identifiers (PO-2025-0587, DOC-11, Q-26-1184) are references, not computed values.
  { re: /\b[A-Z]{1,6}[-/](?:[A-Z0-9]+[-/])*[A-Z0-9]+\b/g, kind: "number", value: () => "__id__" },
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/g, kind: "date", value: (m) => iso(m[1], Number(m[2]), m[3]) },
  { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s-]+${MON},?[\\s-]+(\\d{4})\\b`, "gi"), kind: "date", value: (m) => iso(m[3], monthNum(m[2]), m[1]) },
  { re: new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"), kind: "date", value: (m) => iso(m[3], monthNum(m[1]), m[2]) },
  { re: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, kind: "date", value: (m) => iso(m[3], Number(m[2]), m[1]) }, // dd/mm/yyyy (India)
  {
    re: /(?:₹|\bRs\.?|\bINR)\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(lakhs?|lac|crores?|cr|l)\b)?/gi,
    kind: "money",
    value: (m) => round(num(m[1]) * (m[2] ? UNIT[m[2].toLowerCase()] : 1)),
  },
  { re: /\b(\d[\d,]*(?:\.\d+)?)\s?(lakhs?|lac|crores?)\b/gi, kind: "money", value: (m) => round(num(m[1]) * UNIT[m[2].toLowerCase()]) },
  { re: /\b(\d+(?:\.\d+)?)\s?(?:%|per\s?cent\b)/gi, kind: "percent", value: (m) => Number(m[1]) },
  { re: /\b\d[\d,]*(?:\.\d+)?\b/g, kind: "number", value: (m) => num(m[0]) },
];

export function extractNumericTokens(text: string): NumericToken[] {
  let rest = text;
  const out: NumericToken[] = [];
  for (const rule of RULES) {
    rest = rest.replace(rule.re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      const value = rule.value(m);
      if (value !== "__id__") out.push({ raw: m[0], kind: rule.kind, value });
      return " ".repeat(m[0].length);
    });
  }
  return out;
}

function normaliseAllowed(v: string | number): string | number | null {
  if (typeof v === "number") return round(v);
  const toks = extractNumericTokens(v);
  return toks.length === 1 ? toks[0].value : null;
}

export type FidelityResult = { ok: boolean; tokens: NumericToken[]; violations: NumericToken[] };

/** Any number, ₹ amount, % or date in the draft that is not in allowedValues fails. */
export function numericFidelity(draft: string, allowedValues: (string | number)[]): FidelityResult {
  const allowed = new Set(allowedValues.map(normaliseAllowed).filter((v) => v !== null).map(String));
  const tokens = extractNumericTokens(draft);
  const violations = tokens.filter((t) => !allowed.has(String(t.value)));
  return { ok: violations.length === 0, tokens, violations };
}

/* ------------------------------------------------------------------ */
/* 3. Negotiation boundary                                             */
/* ------------------------------------------------------------------ */

export const BOUNDARY_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "discount", re: /\bdiscount(s|ed|ing)?\b/gi },
  { label: "reduce the price", re: /\breduc(e|ing|tion (in|of)) the (price|fees?|rates?|charges?)\b/gi },
  { label: "lower rate", re: /\blower(ed|ing)? (the |your )?(rates?|price|fees?)\b/gi },
  { label: "we propose", re: /\bwe (would like to |wish to )?propose\b/gi },
  { label: "revised rate", re: /\brevised (rates?|prices?|fees?|pricing)\b/gi },
  { label: "counter-offer", re: /\bcounter[\s-]?offers?\b/gi },
  { label: "better terms", re: /\bbetter (terms|pricing|rates?|deal)\b/gi },
  { label: "renegotiate the price", re: /\brenegotiat(e|ion|ing) (of )?(the |our |your )?(price|pricing|fees?|rates?|terms|commercials)\b/gi },
];

export type BoundaryViolation = { phrase: string; match: string; index: number };

export function boundaryCheck(draft: string): { ok: boolean; violations: BoundaryViolation[] } {
  const violations: BoundaryViolation[] = [];
  for (const { label, re } of BOUNDARY_PATTERNS) {
    for (const m of draft.matchAll(re)) violations.push({ phrase: label, match: m[0], index: m.index ?? 0 });
  }
  return { ok: violations.length === 0, violations };
}
