/**
 * Claude client wrapper. SERVER-ONLY: never import from a client component (reads ANTHROPIC_API_KEY).
 * callJSON validates the reply with zod, retries once with the validation error, then throws FallbackError
 * so the caller can serve the template / cached JSON with a "cached" badge (guardrail 5).
 * Transport errors (429 / 5xx / overloaded / timeouts) are retried by the SDK with exponential backoff.
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

/** Content parts: plain text, or a PDF sent as a document block (Claude reads its text layer and page images). */
export type Part = { text: string } | { pdfBase64: string; title?: string };

/** Per-call record for the pipeline log (tokens are summed over all attempts). */
export type CallMeta = {
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  attempts: number;
  ok: boolean;
  errors: string[];
};

const clients = new Map<string, Anthropic>();
function getClient(maxRetries: number, timeoutMs: number): Anthropic {
  if (typeof window !== "undefined") throw new Error("claude.ts is server-only");
  if (!hasClaudeKey()) throw new FallbackError("ANTHROPIC_API_KEY is not set", 0, "missing key");
  const key = `${maxRetries}:${timeoutMs}`;
  if (!clients.has(key)) clients.set(key, new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries, timeout: timeoutMs }));
  return clients.get(key)!;
}

const stripFences = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");

/** First balanced JSON object in a reply (tolerates a stray sentence before or after it). */
function firstJson(s: string): string {
  const t = stripFences(s);
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

function schemaHint(schema: z.ZodType): string {
  try {
    return `\n\nReply with ONLY a JSON object matching this JSON Schema (no prose, no code fences):\n${JSON.stringify(z.toJSONSchema(schema))}`;
  } catch {
    return "";
  }
}

export type CallOptions = {
  maxAttempts?: number;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  /** Transport retries with backoff (SDK). */
  maxRetries?: number;
  timeoutMs?: number;
  label?: string;
  onMeta?: (m: CallMeta) => void;
};

type Block = Anthropic.Messages.TextBlockParam | Anthropic.Messages.DocumentBlockParam;
const toBlock = (p: Part): Block =>
  "pdfBase64" in p
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.pdfBase64 }, ...(p.title ? { title: p.title } : {}) }
    : { type: "text", text: p.text };

export async function callJSON<S extends z.ZodType>(model: string, system: string, parts: Part[], schema: S, opts: CallOptions = {}): Promise<z.output<S>> {
  const anthropic = getClient(opts.maxRetries ?? 1, opts.timeoutMs ?? 20_000);
  const maxAttempts = opts.maxAttempts ?? 2; // first try + one retry
  const meta: CallMeta = { label: opts.label ?? "call", model, inputTokens: 0, outputTokens: 0, latencyMs: 0, attempts: 0, ok: false, errors: [] };
  const t0 = Date.now();
  const done = (ok: boolean) => {
    meta.ok = ok;
    meta.latencyMs = Date.now() - t0;
    opts.onMeta?.(meta);
  };
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    meta.attempts = attempt;
    const retry = attempt > 1 ? [{ type: "text" as const, text: `Your previous reply was rejected: ${lastError}. Reply again with ONLY valid JSON matching the schema.` }] : [];
    try {
      // Streaming + finalMessage avoids HTTP timeouts on long extraction replies.
      const res = await anthropic.messages
        .stream({
          model,
          max_tokens: opts.maxTokens ?? 4000,
          output_config: { effort: opts.effort ?? "low" },
          system: system + schemaHint(schema),
          messages: [{ role: "user", content: [...parts.map(toBlock), ...retry] }],
        })
        .finalMessage();
      meta.inputTokens += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      meta.outputTokens += res.usage.output_tokens;
      if (res.stop_reason === "refusal") {
        lastError = "model declined";
        meta.errors.push(lastError);
        continue;
      }
      if (res.stop_reason === "max_tokens") {
        lastError = "reply was cut off (max_tokens); be more concise";
        meta.errors.push(lastError);
        continue;
      }
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const parsed = schema.safeParse(JSON.parse(firstJson(text)));
      if (parsed.success) {
        done(true);
        return parsed.data;
      }
      lastError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      meta.errors.push(`schema: ${lastError}`);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        meta.errors.push("auth");
        done(false);
        throw new FallbackError("Invalid ANTHROPIC_API_KEY", attempt, e.message);
      }
      lastError = e instanceof Anthropic.APIError ? `API ${e.status}: ${e.message}` : e instanceof Error ? e.message : String(e);
      meta.errors.push(lastError);
    }
  }
  done(false);
  throw new FallbackError(`Claude output invalid after ${maxAttempts} attempts`, maxAttempts, lastError);
}
