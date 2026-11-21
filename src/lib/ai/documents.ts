/** Format-neutral document handling for the LLM (server-only). */
import { promises as fs } from "node:fs";
import path from "node:path";

const MIME: Record<string, string> = {
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".pdf": "application/pdf",
};

export const mimeTypeFor = (file: string) => MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
export const isTextMime = (m: string) => m.startsWith("text/");

export type DocumentPart = {
  /** Base64 payload + MIME, provider-neutral (Claude: document/text block; PDF support later). */
  part: { mimeType: string; data: string };
  mimeType: string;
  /** Decoded text for quote verification (null for binary formats such as PDF, until we add text extraction). */
  text: string | null;
};

/** Reads file bytes and wraps them with the right MIME type (text/markdown today, application/pdf later). */
export async function loadDocumentPart(filePath: string): Promise<DocumentPart> {
  const bytes = await fs.readFile(filePath);
  const mimeType = mimeTypeFor(filePath);
  return {
    part: { mimeType, data: bytes.toString("base64") },
    mimeType,
    text: isTextMime(mimeType) ? bytes.toString("utf8") : null,
  };
}

export type DocInput = { doc_id: string; filename: string; text?: string | null };
export type DocGroup = { group_id: string; doc_ids: string[]; supplier_hint?: string };

/**
 * Groups documents into contract families (one group per supplier relationship).
 * STUB: one group per document. Real grouping (AI family linking: references, parties, contract refs)
 * comes with live extraction.
 * TODO: test against doc_supplier_map when it arrives (do NOT use documents.json supplier_id as truth).
 */
export async function groupDocuments(docs: DocInput[]): Promise<DocGroup[]> {
  return docs.map((d, i) => ({ group_id: `GRP-${String(i + 1).padStart(2, "0")}`, doc_ids: [d.doc_id] }));
}
