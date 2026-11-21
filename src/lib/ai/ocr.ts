/**
 * OCR for scanned PDFs (no text layer): Claude reads the page images and transcribes them verbatim.
 * Values extracted from OCR text are capped at confidence 0.8 (→ human review). If OCR fails, the
 * document goes to human review; nothing is guessed.
 */
import { z } from "zod";
import { callJSON, type CallMeta } from "./claude";
import { OCR_SYSTEM_PROMPT } from "./prompts";

export const OcrSchema = z.object({ pages: z.array(z.object({ page: z.number(), text: z.string() })) });

const MARKER = (n: number) => `--- Page ${n} ---`;

/** Cache format: page markers for humans; stripped again for prompts and quote verification. */
export const formatOcr = (pages: { page: number; text: string }[]) => pages.map((p) => `${MARKER(p.page)}\n${p.text.trim()}`).join("\n");
export const ocrTextForVerification = (cached: string) =>
  cached
    .split("\n")
    .filter((l) => !/^--- Page \d+ ---$/.test(l.trim()))
    .join("\n")
    .trim();

export async function ocrPdf(docId: string, base64: string, model: string, onMeta?: (m: CallMeta) => void): Promise<string> {
  const out = await callJSON(
    model,
    OCR_SYSTEM_PROMPT,
    [{ pdfBase64: base64, title: docId }, { text: `Transcribe ${docId} page by page.` }],
    OcrSchema,
    { maxTokens: 16000, effort: "low", maxRetries: 4, timeoutMs: 300_000, label: `ocr ${docId}`, onMeta },
  );
  if (!out.pages.length || out.pages.every((p) => !p.text.trim())) throw new Error("OCR returned no text");
  return formatOcr(out.pages);
}
