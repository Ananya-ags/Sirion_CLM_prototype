/**
 * Claude model names (server-only; kept out of config.ts so nothing about the AI setup ships to the browser).
 * Override with env vars without code changes.
 */
export const MODELS = {
  draft: process.env.ANTHROPIC_MODEL_DRAFT ?? "claude-haiku-5-5",
  extract: process.env.ANTHROPIC_MODEL_EXTRACT ?? "claude-haiku-5-5",
} as const;
