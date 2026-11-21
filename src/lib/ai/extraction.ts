/**
 * Per-family extraction call: the family's PDFs as document blocks + their cleaned (or OCR) text.
 * Output is validated with zod (ExtractionLlmSchema); verification and precedence happen in precedence.ts.
 */
import { callJSON, type CallMeta, type Part } from "./claude";
import { footerLines, type PipelineDoc } from "./documents";
import { ExtractionLlmSchema, type ExtractionLlm } from "./precedence";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompts";

export type ExtractionVocab = {
  /** sla_performance.csv metric keys reported for this vendor (trusted operational data). */
  slaMetrics: string[];
  /** usage.csv metric keys reported for this vendor. */
  usageMetrics: string[];
  /** benchmarks.json role names. */
  benchmarkRoles: string[];
};

export function extractionParts(supplierName: string, docs: PipelineDoc[], vocab: ExtractionVocab): Part[] {
  const context = [
    `SUPPLIER: ${supplierName}. CUSTOMER: Velora Consumer Private Limited.`,
    `Family documents: ${docs.map((d) => d.meta.doc_id).join(", ")}.`,
    `Reported SLA metric keys for this vendor: ${vocab.slaMetrics.length ? vocab.slaMetrics.join(", ") : "(none)"}`,
    `Usage metric keys for this vendor: ${vocab.usageMetrics.length ? vocab.usageMetrics.join(", ") : "(none)"}`,
    `Benchmark roles: ${vocab.benchmarkRoles.join("; ")}`,
  ].join("\n");
  const parts: Part[] = [{ text: `TRUSTED CONTEXT\n${context}` }];
  for (const d of docs) {
    const head = `=== ${d.meta.doc_id}${d.meta.received_date ? ` · channel: ${d.meta.source} · received ${d.meta.received_date}` : ""} · ${d.pdf.pages.length} page(s) · ${d.textSource === "ocr" ? "OCR TRANSCRIPTION of a scan (may contain errors)" : d.textSource === "none" ? "NO TEXT (scan, OCR failed)" : "cleaned text"} ===`;
    const foot = footerLines(d.pdf);
    if (d.base64) parts.push({ pdfBase64: d.base64, title: d.meta.doc_id }); // text-only items (snippets) have no PDF
    parts.push({ text: `${head}\n${foot ? `[footer identifiers]\n${foot}\n` : ""}<untrusted_document doc_id="${d.meta.doc_id}">\n${d.text}\n</untrusted_document>` });
  }
  parts.push({ text: `Extract per the instructions for documents ${docs.map((d) => d.meta.doc_id).join(", ")}. Quote verbatim from the text above.` });
  return parts;
}

export async function extractFamily(supplierName: string, docs: PipelineDoc[], vocab: ExtractionVocab, model: string, label: string, onMeta?: (m: CallMeta) => void): Promise<ExtractionLlm> {
  return callJSON(model, EXTRACTION_SYSTEM_PROMPT, extractionParts(supplierName, docs, vocab), ExtractionLlmSchema, {
    maxTokens: 32000,
    effort: "medium",
    maxRetries: 4,
    timeoutMs: 600_000,
    label,
    onMeta,
  });
}
