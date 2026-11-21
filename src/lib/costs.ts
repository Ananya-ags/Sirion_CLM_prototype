/** Cost of one full AI pipeline run, from cache/pipeline_log.json (server-only). */
import { z } from "zod";
import { estimateCostUsd } from "./ai/pricing";
import { loadCache } from "./data";

const LogSchema = z.looseObject({
  runs: z.array(z.looseObject({ calls: z.array(z.looseObject({ scope: z.string(), model: z.string(), input_tokens: z.number(), output_tokens: z.number() })) })),
});

/** The most recent call per scope (OCR, grouping, each supplier's extraction) = one full precompute run. */
export async function fullRunCost(): Promise<{ usd: number; calls: number }> {
  const log = await loadCache("pipeline_log", LogSchema.nullable(), null);
  const latest = new Map<string, { model: string; input_tokens: number; output_tokens: number }>();
  for (const r of log?.runs ?? []) for (const c of r.calls) latest.set(c.scope, c);
  const usd = [...latest.values()].reduce((n, c) => n + (estimateCostUsd(c.model, c.input_tokens, c.output_tokens) ?? 0), 0);
  return { usd, calls: latest.size };
}
