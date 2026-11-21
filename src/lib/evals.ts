/** Shape of docket_data/data/cache/eval_results.json (written by scripts/evals.ts, read by /evals). */
import { z } from "zod";

export const ScoreSchema = z.object({
  fields: z.number(),
  correct: z.number(),
  wrong: z.number(),
  /** Gold is "unclear" (genuinely ambiguous) and the model said "unclear". */
  correct_abstention: z.number(),
  /** Gold has a value but the model said "unclear" (safe, but a miss). */
  wrong_abstention: z.number(),
  /** Gold is "unclear" but the model gave a value. */
  missed_abstention: z.number(),
  /** (correct + correct_abstention) / fields */
  accuracy: z.number(),
});
export type Score = z.infer<typeof ScoreSchema>;

export const MissSchema = z.object({ item: z.string(), expected: z.unknown(), got: z.unknown(), note: z.string().optional() });
export type Miss = z.infer<typeof MissSchema>;

export const SuiteResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  /** One line: what this suite protects against. */
  protects: z.string(),
  status: z.enum(["pass", "fail", "info", "skipped"]),
  passed: z.number(),
  total: z.number(),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  misses: z.array(MissSchema).default([]),
  note: z.string().optional(),
});
export type SuiteResult = z.infer<typeof SuiteResultSchema>;

export const EvalRunSchema = z.object({
  label: z.string(),
  generated_at: z.string(),
  budget: z.object({ limit_usd: z.number(), spent_usd: z.number(), skipped: z.array(z.string()) }),
  headline: z.object({ dev: ScoreSchema.nullable(), heldout: ScoreSchema.nullable() }),
  suites: z.array(SuiteResultSchema),
});
export type EvalRun = z.infer<typeof EvalRunSchema>;

export const EvalResultsSchema = z.object({
  /** e.g. "v2 (after review; no longer blind)". */
  label: z.string().default("v1 (blind)"),
  /** The earlier run kept for comparison, e.g. "v1 (blind)". */
  previous: EvalRunSchema.optional(),
  generated_at: z.string(),
  models: z.object({ extract: z.string(), draft: z.string() }),
  budget: z.object({ limit_usd: z.number(), spent_usd: z.number(), skipped: z.array(z.string()) }),
  headline: z.object({ dev: ScoreSchema.nullable(), heldout: ScoreSchema.nullable() }),
  suites: z.array(SuiteResultSchema),
});
export type EvalResults = z.infer<typeof EvalResultsSchema>;

/** Field outcome vs gold. "unclear" on a genuinely ambiguous item is a correct abstention. */
export type Outcome = "correct" | "wrong" | "correct_abstention" | "wrong_abstention" | "missed_abstention";

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().replace(/\s+/g, " ") : v);
export function sameValue(got: unknown, expected: unknown): boolean {
  if (got === null || expected === null || got === undefined || expected === undefined) return (got ?? null) === (expected ?? null);
  if (typeof expected === "number" || typeof got === "number") return Number(got) === Number(expected);
  return norm(got) === norm(expected);
}

export function outcome(got: unknown, expected: unknown): Outcome {
  if (expected === "unclear") return got === "unclear" ? "correct_abstention" : "missed_abstention";
  if (sameValue(got, expected)) return "correct";
  return got === "unclear" ? "wrong_abstention" : "wrong";
}

export function score(outcomes: Outcome[]): Score {
  const c = (o: Outcome) => outcomes.filter((x) => x === o).length;
  const s = { fields: outcomes.length, correct: c("correct"), wrong: c("wrong"), correct_abstention: c("correct_abstention"), wrong_abstention: c("wrong_abstention"), missed_abstention: c("missed_abstention") };
  return { ...s, accuracy: s.fields ? (s.correct + s.correct_abstention) / s.fields : 0 };
}

/**
 * Section labels → comparable tokens: clause numbers ("cl. 14.2", "14.2" → "14.2"), "para 1" → "1",
 * Schedule / Annexure / Annex / Appendix X → "sched:x" (equivalent forms), Order Form / Order Schedule → "orderform",
 * Preamble / Parties → "parties". Gold's "via" clauses count too.
 */
export function sectionTokens(section: string): Set<string> {
  const s = section.toLowerCase().replace(/[–—]/g, "-");
  const t = new Set<string>();
  for (const m of s.matchAll(/\b\d+(?:\.\d+)+\b/g)) t.add(m[0]);
  for (const m of s.matchAll(/\b(?:schedule|annexure|annex|appendix|exhibit)\s+([a-z0-9]+)\b/g)) t.add(`sched:${m[1]}`);
  for (const m of s.matchAll(/\bpara(?:graph)?\.?\s*(\d+)\b/g)) t.add(m[1]);
  if (/\border (?:form|schedule)\b/.test(s)) t.add("orderform");
  if (/\b(?:preamble|parties)\b/.test(s)) t.add("parties");
  const bare = s.trim().match(/^(?:cl(?:ause)?\.?\s*|section\s*|§\s*)?(\d+(?:\.\d+)*)$/);
  if (bare) t.add(bare[1]);
  for (const m of s.matchAll(/\b(\d+\.\d+)\s*-\s*(\d+\.\d+)\b/g)) [m[1], m[2]].forEach((x) => t.add(x));
  return t;
}

export function sectionMatches(got: string, gold: string): boolean {
  const g = sectionTokens(gold);
  return [...sectionTokens(got)].some((x) => g.has(x));
}

export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))];
}
