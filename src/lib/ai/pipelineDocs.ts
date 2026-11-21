/**
 * Builds PipelineDocs (server-only) for the pipeline and the evals, so both use the SAME functions.
 * Reads PDFs (text layer via pdfText) and cached OCR text; never docs_src, never gold.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, loadDocuments } from "../data";
import type { DocumentMeta } from "../types";
import { sha256, type PipelineDoc } from "./documents";
import { ocrTextForVerification } from "./ocr";
import { cleanPages, pdfText } from "./pdfText";

export const CACHE_DIR = path.join(DATA_DIR, "cache");

const metaFor = (docId: string, file: string): DocumentMeta => ({ doc_id: docId, filename: docId, source: "sharepoint", source_path: "", received_date: "", file });

/** A PDF as a PipelineDoc (text layer if present; textSource "none" for scans until OCR fills it). */
export async function pipelineDocFromPdf(absPath: string, meta: DocumentMeta): Promise<PipelineDoc> {
  const bytes = await readFile(absPath);
  const pdf = await pdfText(new Uint8Array(bytes));
  return { meta, hash: sha256(bytes), base64: bytes.toString("base64"), pdf, text: pdf.text, textSource: pdf.hasTextLayer ? "pdf" : "none" };
}

/** A text snippet (held-out .md items) as a PipelineDoc: no PDF block, text only. */
export function pipelineDocFromText(docId: string, text: string): PipelineDoc {
  const pdf = cleanPages([text]);
  return { meta: metaFor(docId, `${docId}.md`), hash: sha256(text), base64: "", pdf: { ...pdf, text }, text, textSource: "pdf" };
}

/** All documents in documents.json, with cached OCR text for scans (no API calls). */
export async function loadDocsForPipeline(): Promise<PipelineDoc[]> {
  const metas = await loadDocuments();
  const out: PipelineDoc[] = [];
  for (const m of metas) {
    const d = await pipelineDocFromPdf(path.join(DATA_DIR, "docs", path.basename(m.file)), m);
    const ocr = path.join(CACHE_DIR, `ocr_${m.doc_id}.txt`);
    if (d.textSource === "none" && existsSync(ocr)) {
      d.text = ocrTextForVerification(await readFile(ocr, "utf8"));
      d.textSource = "ocr";
    }
    out.push(d);
  }
  return out;
}

export { metaFor as heldoutMeta };
