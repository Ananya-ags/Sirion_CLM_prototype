/** Display helpers for contract families (pure). */
import { ROLE_LABEL } from "./labels";

type Doc = { doc_id: string; doc_role: string; executed: boolean | "unknown"; references: string[] };

const CHILD_ROLES = new Set(["sow", "order_form", "amendment"]);

/**
 * Display role. A standalone executed document classified "other" — no parent it refers to, no SOW / order form /
 * amendment referring to it, and no executed MSA in the family — IS the agreement (e.g. a scanned facilities
 * agreement or a one-off training agreement), so it shows as "Agreement" rather than "Other".
 * Emails / quotes that mention it don't make it a child document.
 */
export function displayRole(doc: Doc, family: Doc[]): string {
  if (doc.doc_role === "other" && doc.executed === true) {
    const ids = new Set(family.map((d) => d.doc_id));
    const hasParent = doc.references.some((r) => r !== doc.doc_id && ids.has(r));
    const isParent = family.some((d) => d.doc_id !== doc.doc_id && CHILD_ROLES.has(d.doc_role) && d.references.includes(doc.doc_id));
    const hasMsa = family.some((d) => d.doc_role === "msa" && d.executed === true);
    if (!hasParent && !isParent && !hasMsa) return "Agreement";
  }
  return ROLE_LABEL[doc.doc_role] ?? doc.doc_role;
}

/** Top-level documents (agreements / MSAs) sit flush left in the family tree. */
export const isTopLevel = (doc: Doc, family: Doc[]) => doc.doc_role === "msa" || displayRole(doc, family) === "Agreement";
