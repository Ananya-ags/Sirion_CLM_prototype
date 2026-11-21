/**
 * Gemini client wrapper. SERVER-ONLY: never import from a client component (it reads GEMINI_API_KEY).
 * callJSON validates the reply with zod, retries once with the validation error, then throws FallbackError
 * so the caller can serve cached JSON with a "cached" badge (guardrail 5).
 */
import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

export class FallbackError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly lastError: string,
  ) {
    super(message);
    this.name = "FallbackError";
  }
}

export const hasGeminiKey = () => !!process.env.GEMINI_API_KEY;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (typeof window !== "undefined") throw new Error("gemini.ts is server-only");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new FallbackError("GEMINI_API_KEY is not set", 0, "missing key");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

const stripFences = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

function schemaHint(schema: z.ZodType): string {
  try {
    return `\n\nReply with JSON matching this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`;
  } catch {
    return "";
  }
}

export type CallOptions = { temperature?: number; maxAttempts?: number };

export async function callJSON<S extends z.ZodType>(model: string, system: string, parts: Part[], schema: S, opts: CallOptions = {}): Promise<z.output<S>> {
  const ai = getClient();
  const maxAttempts = opts.maxAttempts ?? 2; // first try + one retry
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retryNote: Part[] = attempt > 1 ? [{ text: `Your previous reply was rejected: ${lastError}. Reply again with ONLY valid JSON matching the schema.` }] : [];
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [...parts, ...retryNote] }],
        config: { systemInstruction: system + schemaHint(schema), responseMimeType: "application/json", temperature: opts.temperature ?? 0 },
      });
      const parsed = schema.safeParse(JSON.parse(stripFences(res.text ?? "")));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new FallbackError(`Gemini output invalid after ${maxAttempts} attempts`, maxAttempts, lastError);
}
