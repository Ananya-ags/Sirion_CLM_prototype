import { promises as fs } from "node:fs";
import { docPath } from "@/lib/data";

/** Serves original contract PDFs (read-only) so cited quotes can be checked against the source. */
export async function GET(_req: Request, ctx: RouteContext<"/api/docs/[docId]">) {
  const { docId } = await ctx.params;
  if (!/^DOC-\d{2}$/.test(docId)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await fs.readFile(docPath(`${docId}.pdf`));
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${docId}.pdf"`, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
