/** USD per million tokens (input, output) for cost estimates in the pipeline log. Standard API rates. */
export const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 }, // prompts ≤ 100K tokens
  "claude-opus-5-5": { input: 4, output: 20 },
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICE_PER_MTOK[model];
  return p ? (inputTokens * p.input + outputTokens * p.output) / 1e6 : null;
}
