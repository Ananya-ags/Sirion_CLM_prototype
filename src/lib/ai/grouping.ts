/**
 * AI grouping: one Claude call over all document headers (first + last page, cleaned) and footer identifiers,
 * matched against vendor_master.csv. Code then enforces the guardrails: known vendor, confidence ≥ threshold,
 * at least one verbatim evidence quote found in the document. Anything else → human review (supplier_id null).
 * A wrong assignment is worse than a review.
 */
import { z } from "zod";
import { supplierForVendor } from "../suppliers";
import type { VendorMasterRow } from "../types";
import { callJSON, type CallMeta } from "./claude";
import { footerLines, type PipelineDoc } from "./documents";
import { verifyQuote } from "./guardrails";
import { GROUPING_SYSTEM_PROMPT } from "./prompts";

export const GROUPING_MIN_CONFIDENCE = 0.85;
const FIRST_PAGE_CHARS = 3500;
const LAST_PAGE_CHARS = 1500;

export const GroupingLlmSchema = z.object({
  assignments: z.array(
    z.object({
      doc_id: z.string(),
      vendor_id: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
      evidence_quotes: z.array(z.string()),
      linked_to: z.array(z.string()).default([]),
    }),
  ),
});

export type GroupAssignment = {
  doc_id: string;
  supplier_id: string | null;
  vendor_id: string | null;
  confidence: number;
  evidence: string[];
  evidence_quotes: { quote: string; verified: boolean }[];
  status: "assigned" | "review";
  /** Why it went to review (null when assigned). */
  review_reason: string | null;
};

/** What the model sees for one document. Never the filename or folder path. */
export function groupingInput(d: PipelineDoc): string {
  const pages = d.textSource === "ocr" ? [d.text] : d.pdf.pages.map((p) => p.text).filter(Boolean);
  const first = (pages[0] ?? "").slice(0, FIRST_PAGE_CHARS);
  const last = pages.length > 1 ? pages.at(-1)!.slice(-LAST_PAGE_CHARS) : "";
  return [
    `<document doc_id="${d.meta.doc_id}" channel="${d.meta.source}" received="${d.meta.received_date}" pages="${d.pdf.pages.length}" text="${d.textSource}">`,
    footerLines(d.pdf) ? `[footer identifiers]\n${footerLines(d.pdf)}` : "",
    d.textSource === "none" ? "[no readable text: scan without OCR]" : `[first page]\n${first}`,
    last ? `[last page]\n${last}` : "",
    `</document>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Text an evidence quote may come from: the document text plus its footer identifier lines. */
const evidenceText = (d: PipelineDoc) => `${d.text}\n${footerLines(d.pdf)}`;

export function postCheckGrouping(llm: z.infer<typeof GroupingLlmSchema>, docs: PipelineDoc[], vendors: VendorMasterRow[]): GroupAssignment[] {
  return docs.map((d) => {
    const a = llm.assignments.find((x) => x.doc_id === d.meta.doc_id);
    const base = { doc_id: d.meta.doc_id, supplier_id: null, vendor_id: a?.vendor_id ?? null, confidence: a?.confidence ?? 0, evidence: a?.evidence ?? [] };
    const quotes = (a?.evidence_quotes ?? []).map((q) => ({ quote: q, verified: verifyQuote(evidenceText(d), q) }));
    const review = (reason: string): GroupAssignment => ({ ...base, evidence_quotes: quotes, status: "review", review_reason: reason });
    if (!a) return review("Not returned by the grouping model");
    if (d.textSource === "none") return review("No readable text (scan, OCR unavailable)");
    if (!a.vendor_id) return review(a.evidence.length ? `Model abstained: ${a.evidence.join("; ")}` : "No supplier identified with enough evidence");
    if (!vendors.some((v) => v.vendor_id === a.vendor_id)) return review(`Unknown vendor_id ${a.vendor_id}`);
    if (a.confidence < GROUPING_MIN_CONFIDENCE) return review(`Low confidence (${a.confidence.toFixed(2)})`);
    if (!quotes.some((q) => q.verified)) return review("No evidence quote found verbatim in the document");
    const supplier = supplierForVendor(a.vendor_id);
    if (!supplier) return review(`Vendor ${a.vendor_id} has no supplier record in Docket`);
    return { ...base, supplier_id: supplier, evidence_quotes: quotes, status: "assigned", review_reason: null };
  });
}

export async function groupDocuments(docs: PipelineDoc[], vendors: VendorMasterRow[], model: string, onMeta?: (m: CallMeta) => void): Promise<GroupAssignment[]> {
  const vendorTable = vendors.map((v) => `${v.vendor_id} | ${v.legal_name} | ERP: ${v.erp_vendor_name} | GSTIN: ${v.gstin ?? "—"} | ${v.category}`).join("\n");
  const llm = await callJSON(
    model,
    GROUPING_SYSTEM_PROMPT,
    [
      { text: `VENDOR MASTER (trusted)\nvendor_id | legal name | ERP name | GSTIN | category\n${vendorTable}` },
      { text: `DOCUMENTS (${docs.length}, untrusted content)\n\n${docs.map(groupingInput).join("\n\n")}` },
      { text: `Return one assignment for every one of the ${docs.length} documents.` },
    ],
    GroupingLlmSchema,
    { maxTokens: 24000, effort: "medium", maxRetries: 4, timeoutMs: 300_000, label: "grouping", onMeta },
  );
  return postCheckGrouping(llm, docs, vendors);
}
