/**
 * In-memory sliding-window rate limiter (per server instance; resets on cold start). Protects the Claude budget:
 * a public demo link must not let one visitor run up API costs. Good enough for a prototype; use a shared store
 * (e.g. Redis / Upstash) in production.
 */
const hits = new Map<string, number[]>();

export type RateResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs = 60 * 60 * 1000, now = Date.now()): RateResult {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k); // bound memory
  return { ok: true, remaining: limit - recent.length, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/** Limits per route (per IP per hour). */
export const LIMITS = { draft: 10, evaluate: 60 } as const;
