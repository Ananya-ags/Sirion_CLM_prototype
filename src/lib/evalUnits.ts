/** Unit captions for every "X/Y" score: what is counted and out of what. Counts are read from eval_results.json. */
import type { EvalResults } from "@/lib/evals";

export type Unit = {
  /** One word for tight tiles, e.g. "fields". */
  short: string;
  /** One-line caption (13–14px, muted). */
  caption: string;
  /** Longer detail for a tooltip. */
  tip?: string;
};

export type UnitKey =
  | "heldout"
  | "dev"
  | "grouping"
  | "citations"
  | "section"
  | "abstention"
  | "injection"
  | "drafts"
  | "boundary"
  | "numeric"
  | "stability"
  | "rules"
  | "rulesGold"
  | "ocr"
  | "calibration";

/** Fields scored per supplier in the dev set (gold key fields). */
const DEV_FIELDS_PER_SUPPLIER = 17;

export function evalUnits(r: EvalResults): Record<UnitKey, Unit> {
  const suite = (id: string) => r.suites.find((s) => s.id === id) ?? r.previous?.suites.find((s) => s.id === id);
  const metric = (id: string, label: string) => suite(id)?.metrics.find((m) => m.label === label)?.value;
  const hoItems = suite("heldout")?.metrics.filter((m) => /^HO-\d+$/.test(m.label)).length ?? 0;
  const hoFields = r.headline.heldout?.fields ?? r.previous?.headline.heldout?.fields ?? 0;
  const devFields = r.headline.dev?.fields ?? 0;
  const devSuppliers = Math.round(devFields / DEV_FIELDS_PER_SUPPLIER);
  const stab = suite("stability")?.status === "skipped" ? r.previous?.suites.find((s) => s.id === "stability") : suite("stability");
  const stabSuppliers = stab?.metrics.length ?? 0;
  const [devQ, hoQ] = [metric("citations", "Quote exists (dev)"), metric("citations", "Quote exists (held-out)")];

  return {
    heldout: {
      short: "fields",
      caption: `contract fields correct, out of ${hoFields} checked`,
      tip: `Contract fields extracted correctly, out of ${hoFields} checked against the answer key (${hoItems} unseen clauses & contracts).`,
    },
    dev: {
      short: "fields",
      caption: `fields correct, ${devSuppliers} suppliers × ${DEV_FIELDS_PER_SUPPLIER} fields`,
      tip: `Fields correct across ${devSuppliers} suppliers × ${DEV_FIELDS_PER_SUPPLIER} fields. Prompts were tuned on this set, so it is optimistic.`,
    },
    grouping: { short: "docs", caption: "documents matched to the right supplier" },
    citations: {
      short: "quotes",
      caption: "quoted clauses found verbatim in the source PDF",
      tip: devQ && hoQ ? `Dev ${devQ} + held-out ${hoQ}` : undefined,
    },
    section: { short: "citations", caption: "citations pointing to the correct clause number", tip: "Dev set. A match on the operative or the “via” clause counts." },
    abstention: { short: "items", caption: "ambiguous items correctly answered “unclear”" },
    injection: { short: "checks", caption: "checks where hidden instructions in a contract were ignored" },
    drafts: { short: "drafts", caption: "live AI drafts that passed both the negotiation and number checks" },
    boundary: { short: "drafts", caption: "live AI drafts that passed the negotiation-language check" },
    numeric: { short: "drafts", caption: "live AI drafts whose every number and date matched the Rules values" },
    stability: {
      short: "fields",
      caption: "field values identical across 3 repeated runs",
      tip: stabSuppliers ? `${stabSuppliers} suppliers × ${DEV_FIELDS_PER_SUPPLIER} fields` : undefined,
    },
    rules: { short: "tests", caption: "automated tests of the rules engine against the answer key", tip: "vitest: rules engine, pipeline and eval unit tests." },
    rulesGold: { short: "checks", caption: "answer-key checks passing on both the seed and the AI-extracted data" },
    ocr: { short: "fields", caption: "fields correct on the held-out scanned contract (HO-18)" },
    calibration: { short: "fields", caption: "fields correct across dev + held-out; split by confidence in the detail" },
  };
}
