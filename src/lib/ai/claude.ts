/**
 * Claude client wrapper. SERVER-ONLY: never import from a client component (reads ANTHROPIC_API_KEY).
 * callJSON validates the reply with zod, retries once with the validation error, then throws FallbackError
 * so the caller can serve the template / cached JSON with a "cached" badge (guardrail 5).
 */
import Anthropic from "@anthropic-ai/sdk";
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

export const hasClaudeKey = () => !!process.env.ANTHROPIC_API_KEY;

/** Text-only content parts (documents are passed as text blocks for now; PDFs later). */
export type Part = { text: string };

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (typeof window !== "undefined") throw new Error("claude.ts is server-only");
  if (!hasClaudeKey()) throw new FallbackError("ANTHROPIC_API_KEY is not set", 0, "missing key");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 20_000 });
  return client;
}

const stripFences = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

function schemaHint(schema: z.ZodType): string {
  try {
    return `\n\nReply with ONLY a JSON object matching this JSON Schema (no prose, no code fences):\n${JSON.stringify(z.toJSONSchema(schema))}`;
  } catch {
    return "";
  }
}

export type CallOptions = { maxAttempts?: number; maxTokens?: number };

export async function callJSON<S extends z.ZodType>(model: string, system: string, parts: Part[], schema: S, opts: CallOptions = {}): Promise<z.output<S>> {
  const anthropic = getClient();
  const maxAttempts = opts.maxAttempts ?? 2; // first try + one retry
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const retry = attempt > 1 ? [{ type: "text" as const, text: `Your previous reply was rejected: ${lastError}. Reply again with ONLY valid JSON matching the schema.` }] : [];
    try {
      const res = await anthropic.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 4000,
        output_config: { effort: "low" },
        system: system + schemaHint(schema),
        messages: [{ role: "user", content: [...parts.map((p) => ({ type: "text" as const, text: p.text })), ...retry] }],
      });
      if (res.stop_reason === "refusal") {
        lastError = "model declined";
        continue;
      }
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const parsed = schema.safeParse(JSON.parse(stripFences(text)));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new FallbackError("Invalid ANTHROPIC_API_KEY", attempt, e.message);
      lastError = e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e);
    }
  }
  throw new FallbackError(`Claude output invalid after ${maxAttempts} attempts`, maxAttempts, lastError);
}
