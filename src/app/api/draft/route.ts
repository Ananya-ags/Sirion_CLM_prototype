import { NextResponse } from "next/server";
import { z } from "zod";
import { generateDraft } from "@/lib/drafting";

const Body = z.object({ requestId: z.string().regex(/^REQ-SUP-\d{2}$/), kind: z.enum(["exit_notice", "cap_letter"]) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const r = await generateDraft(parsed.data.requestId, parsed.data.kind);
  return r.status === 200 ? NextResponse.json(r.draft) : NextResponse.json({ error: r.error }, { status: r.status });
}
