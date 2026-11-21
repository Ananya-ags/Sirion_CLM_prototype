/**
 * PDF → clean text (server-only). The pipeline reads ONLY docket_data/data/docs/*.pdf (never docs_src).
 *
 * Every page of the data pack ends with a running footer:
 *   [DocuSign Envelope ID: <uuid>]            (DocuSign-routed documents only)
 *   <DOCUMENT TITLE> [CONFIDENTIAL | DRAFT — NOT FOR SIGNATURE]
 *   Page x of y
 * Drafts also carry a stand-alone "DRAFT" watermark line. These are stripped so that clauses that cross a
 * page break join up again; the envelope ID and the CONFIDENTIAL/DRAFT marker are kept as metadata
 * (they are execution / grouping evidence that comes from the document itself, not its filename).
 */
import { extractText, getDocumentProxy } from "unpdf";

/** A page with fewer non-space characters than this has no usable text layer (scan → OCR). */
export const MIN_PAGE_CHARS = 40;

export type PdfPage = { page: number; raw: string; text: string; hasText: boolean };

export type PdfText = {
  pages: PdfPage[];
  /** Cleaned text of all pages joined, so clauses spanning a page break stay intact. */
  text: string;
  /** False when ANY page lacks a text layer (the document then needs OCR). */
  hasTextLayer: boolean;
  /** From the running footer (not the filename). */
  footer: { title: string | null; marker: "CONFIDENTIAL" | "DRAFT" | null; envelopeIds: string[] };
};

const PAGE_RE = /^\s*Page\s+\d+\s+of\s+\d+\s*$/i;
const ENVELOPE_RE = /^\s*DocuSign Envelope ID:\s*([0-9A-F-]{36})\s*$/i;
const MARKER_RE = /\s+(CONFIDENTIAL|DRAFT\s*[—–-]\s*NOT FOR SIGNATURE)\s*$/i;
const WATERMARK_RE = /^\s*DRAFT\s*$/;

/** Strips the running footer from one page's lines; returns the cleaned lines and what it found. */
export function stripFooter(lines: string[]): { body: string[]; title: string | null; marker: PdfText["footer"]["marker"]; envelope: string | null } {
  const L = [...lines];
  while (L.length && !L.at(-1)!.trim()) L.pop();
  let title: string | null = null;
  let marker: PdfText["footer"]["marker"] = null;
  let envelope: string | null = null;
  if (L.length && PAGE_RE.test(L.at(-1)!)) {
    L.pop();
    // The line above "Page x of y" is always the running title (+ marker) in this data pack.
    if (L.length) {
      const t = L.pop()!.trim();
      const m = t.match(MARKER_RE);
      marker = m ? (m[1].toUpperCase().startsWith("DRAFT") ? "DRAFT" : "CONFIDENTIAL") : null;
      title = t.replace(MARKER_RE, "").trim() || null;
    }
    // Then an optional watermark and envelope line, in either order.
    for (let k = 0; k < 2 && L.length; k++) {
      const e = L.at(-1)!.match(ENVELOPE_RE);
      if (e) {
        envelope = e[1].toUpperCase();
        L.pop();
      } else if (WATERMARK_RE.test(L.at(-1)!)) L.pop();
    }
  }
  return { body: L.filter((l) => !WATERMARK_RE.test(l) && !ENVELOPE_RE.test(l)), title, marker, envelope };
}

/** Joins wrapped lines into readable text: line-break hyphens re-join, whitespace normalised, paragraphs kept. */
export function cleanLines(lines: string[]): string {
  return lines
    .join("\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/([A-Za-z])-\n(?=[a-z])/g, "$1-") // "relationship-\nmanagement" → "relationship-management" (the renderer never soft-hyphenates)
    .replace(/ *\n */g, "\n")
    .trim();
}

export function cleanPages(rawPages: string[]): PdfText {
  const envelopeIds = new Set<string>();
  let title: string | null = null;
  let marker: PdfText["footer"]["marker"] = null;
  const pages: PdfPage[] = rawPages.map((raw, i) => {
    const hasText = raw.replace(/\s/g, "").length >= MIN_PAGE_CHARS;
    const f = stripFooter(raw.split("\n"));
    if (f.envelope) envelopeIds.add(f.envelope);
    title ??= f.title;
    marker ??= f.marker;
    return { page: i + 1, raw, text: hasText ? cleanLines(f.body) : "", hasText };
  });
  return {
    pages,
    text: pages.map((p) => p.text).filter(Boolean).join("\n"),
    hasTextLayer: pages.length > 0 && pages.every((p) => p.hasText),
    footer: { title, marker, envelopeIds: [...envelopeIds] },
  };
}

export async function pdfText(bytes: Uint8Array): Promise<PdfText> {
  // unpdf/pdf.js may detach the buffer it is given: pass a copy so callers can still base64 the original.
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: false });
  return cleanPages(text as string[]);
}
