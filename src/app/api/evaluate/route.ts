/**
 * Re-runs the rules engine for one supplier with human overrides from Priya's review queue
 * (confirmed / corrected fields → source "human", confidence 1.0). Returns the re-evaluated SupplierView.
 * Deterministic Rules only: no LLM call here.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { FIELD_KEYS } from "@/lib/ai/precedence";
import { clientIp, LIMITS, rateLimit } from "@/lib/rateLimit";
import { getSupplierView } from "@/lib/seed";

const Body = z.object({
  supplierId: z.string().regex(/^SUP-\d{2}$/),
  overrides: z.array(z.object({ key: z.enum(FIELD_KEYS), action: z.enum(["confirmed", "corrected"]), value: z.string().max(300).optional() })).max(40),
});

export async function POST(req: Request) {
  // No Claude call here (Rules only), so the limit is looser than /api/draft; it still bounds abuse.
  const rl = rateLimit(`evaluate:${clientIp(req)}`, LIMITS.evaluate);
  if (!rl.ok) return NextResponse.json({ error: `Too many re-evaluations; try again in ~${Math.ceil(rl.retryAfterSec / 60)} min.` }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const view = await getSupplierView(parsed.data.supplierId, parsed.data.overrides);
  if (!view) return NextResponse.json({ error: "Unknown supplier" }, { status: 404 });
  return NextResponse.json(view);
}
