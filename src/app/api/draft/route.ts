import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDraft } from "@/lib/drafting";
import { clientIp, LIMITS, rateLimit } from "@/lib/rateLimit";

/** Live drafts take ~6–7s (occasionally longer); keep them clear of Vercel's default function limit. */
export const maxDuration = 30;

const Body =z.object({ requestId: z.string().regex(/^REQ-SUP-\d{2}$/), kind: z.enum(["exit_notice", "cap_letter"]) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  // ~10 live Claude drafts per IP per hour; beyond that the (labelled) template is returned instead.
  const rl = rateLimit(`draft:${clientIp(req)}`, LIMITS.draft);
  const templateOnly = rl.ok ? undefined : `Live AI limit reached (${LIMITS.draft} drafts per hour); template used. Try again in ~${Math.ceil(rl.retryAfterSec / 60)} min.`;
  const r = await generateDraft(parsed.data.requestId, parsed.data.kind, { templateOnly });
  return r.status === 200 ? NextResponse.json(r.draft) : NextResponse.json({ error: r.error }, { status: r.status });
}
