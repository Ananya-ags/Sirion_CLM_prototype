/** Plain-language phrases for flags (no codes): used in the budget-owner and finance views. Numbers come from Rules. */
import { formatINRShort } from "./format";
import type { Flag } from "./types";

export function plainFlag(f: Pick<Flag, "code" | "impactInr" | "detail">): string {
  const r = f.impactInr ? ` (${formatINRShort(f.impactInr)})` : "";
  switch (f.code) {
    case "F1": return "Renews automatically unless we give notice";
    case "F2": return `Price rises automatically at renewal${r}`;
    case "F3": return `Supplier quoted above the contract cap${r}`;
    case "F4": return `We pay above the market rate${r}`;
    case "F5": return "No refund if the service level is missed";
    case "F6": return "We can't exit early";
    case "F7": return "Payment terms are shorter than our policy";
    case "L1": return `We've spent more than the contract value${r}`;
    case "L2": return `We kept paying after the contract ended${r}`;
    case "L3": return `Invoices are above the agreed price${r}`;
    case "L4": return `Recurring spend isn't on the tracker${r}`;
    case "T1": return "Our tracker disagrees with the signed contract";
    case "X1": return "A key clause is unclear; Procurement is checking";
    case "X2": return "Notice must go by a special method";
    case "S1": return `Supplier missed its service level; credit unclaimed${r}`;
    case "U1": return `Some licences are unused${r}`;
    default: return f.detail;
  }
}

/** Short alert titles for Finance (no codes). */
export const FINANCE_TITLE: Partial<Record<Flag["code"], string>> = {
  L1: "Spent more than the contract",
  L2: "Paid after the contract ended",
  L3: "Billed above the agreed price",
  L4: "Recurring spend, no contract on the tracker",
  S1: "SLA credit not claimed",
};
