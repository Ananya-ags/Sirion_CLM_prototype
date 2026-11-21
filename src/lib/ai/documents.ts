/**
 * Format-neutral document handling for the LLM (server-only).
 * The pipeline reads ONLY docket_data/data/docs/*.pdf (+ documents.json). Never docs_src/, never gold.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DocumentMeta } from "../types";
import { pdfText, type PdfText } from "./pdfText";

const MIME: Record<string, string> = {
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
};

export const mimeTypeFor = (file: string) => MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
export const isTextMime = (m: string) => m.startsWith("text/");
export const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");

export type DocumentPart = {
  /** Base64 payload + MIME (Claude: document block for PDFs, text block otherwise). */
  part: { mimeType: string; data: string };
  mimeType: string;
  /** Cleaned text for prompts and quote verification. For a PDF without a text layer this is "" (→ OCR). */
  text: string | null;
  /** PDF only: per-page text, footer metadata, text-layer flag. */
  pdf?: PdfText;
  hash: string;
};

/** Reads file bytes; PDFs also get cleaned text (running headers/footers stripped, pages joined). */
export async function loadDocumentPart(filePath: string): Promise<DocumentPart> {
  const bytes = await fs.readFile(filePath);
  const mimeType = mimeTypeFor(filePath);
  const hash = sha256(bytes);
  if (mimeType === "application/pdf") {
    const pdf = await pdfText(new Uint8Array(bytes));
    return { part: { mimeType, data: bytes.toString("base64") }, mimeType, text: pdf.text, pdf, hash };
  }
  return { part: { mimeType, data: bytes.toString("base64") }, mimeType, text: isTextMime(mimeType) ? bytes.toString("utf8") : null, hash };
}

/** A document as the pipeline sees it: metadata + bytes + text (PDF text layer or OCR). */
export type PipelineDoc = {
  meta: DocumentMeta;
  hash: string;
  base64: string;
  pdf: PdfText;
  /** Text used for prompts and quote verification. */
  text: string;
  textSource: "pdf" | "ocr" | "none";
};

/** Footer identifiers as text lines (so grouping evidence quotes can be verified against them). */
export const footerLines = (pdf: PdfText) =>
  [...pdf.footer.envelopeIds.map((e) => `DocuSign Envelope ID: ${e}`), ...(pdf.footer.title ? [`Running title: ${pdf.footer.title}${pdf.footer.marker ? ` ${pdf.footer.marker}` : ""}`] : [])].join("\n");
