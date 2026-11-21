import { describe, expect, it } from "vitest";
import { rateLimit } from "./rateLimit";

describe("rateLimit", () => {
  it("allows N calls per window, then blocks until the oldest expires", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(rateLimit("ip-a", 10, 3600_000, t0 + i).ok).toBe(true);
    const blocked = rateLimit("ip-a", 10, 3600_000, t0 + 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(3500);
    expect(rateLimit("ip-b", 10, 3600_000, t0 + 20).ok).toBe(true); // per key
    expect(rateLimit("ip-a", 10, 3600_000, t0 + 3600_001).ok).toBe(true); // window slid
  });
});
