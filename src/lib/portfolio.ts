/** Server-side portfolio snapshot for every screen. Static case data → cached at build time. */
import { loadDevGold, loadDocuments, loadGrouping, loadLedger, loadPolicy, loadTracker } from "./data";
import { buildInitialRequests, getAllSupplierViews, type SupplierView } from "./seed";
import type { DocumentMeta, Policy, Request } from "./types";

export type UnmatchedDoc = { doc: DocumentMeta; evidence: string[]; reason: string; confidence: number | null; source: "ai" | "seed" };
export type Portfolio = {
  views: SupplierView[];
  requests: Request[];
  unmatched: UnmatchedDoc[];
  sources: { email: number; sharepoint: number; docusign: number; tracker: number; ledger: number };
  policy: Policy;
  documents: DocumentMeta[];
};

export async function getPortfolio(): Promise<Portfolio> {
  "use cache";
  const [views, docs, gold, tracker, ledger, policy, grouping] = await Promise.all([getAllSupplierViews(), loadDocuments(), loadDevGold(), loadTracker(), loadLedger(), loadPolicy(), loadGrouping()]);
  // AI grouping: every document the grouping sent to review (null supplier). Seed fallback: gold map nulls.
  const unmatched: UnmatchedDoc[] = (
    grouping
      ? grouping.assignments.filter((a) => a.status === "review").map((a) => ({ doc_id: a.doc_id, evidence: a.evidence, reason: a.review_reason ?? "Uncertain", confidence: a.confidence, source: "ai" as const }))
      : (gold.doc_supplier_map ?? []).filter((m) => m.supplier_id === null).map((m) => ({ doc_id: m.doc_id, evidence: m.evidence, reason: "No supplier match", confidence: null, source: "seed" as const }))
  )
    .map(({ doc_id, ...rest }) => ({ doc: docs.find((d) => d.doc_id === doc_id)!, ...rest }))
    .filter((u) => !!u.doc);
  const count = (s: string) => docs.filter((d) => d.source === s).length;
  return {
    views,
    requests: buildInitialRequests(views),
    unmatched,
    sources: { email: count("email"), sharepoint: count("sharepoint"), docusign: count("docusign"), tracker: tracker.length, ledger: ledger.length },
    policy,
    documents: docs,
  };
}

export const viewById = (p: Portfolio, id: string) => p.views.find((v) => v.supplierId === id) ?? null;
