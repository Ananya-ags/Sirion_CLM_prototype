/** ₹ maths (Rules). The LLM never computes any of this. */
import { CPI_INDIA_YOY_PCT, FX } from "../config";

export { formatINR, formatINRShort } from "../format";

export type UpliftType = "fixed" | "cpi" | "greater_of" | "discretionary" | "none";

export type UpliftResult = {
  /** Effective uplift %. null = uncapped discretionary (unbounded exposure). */
  pct: number | null;
  basis: string;
};

const fmtPct = (n: number) => `${Number(n.toFixed(2))}%`;

export function effectiveUplift(
  type: UpliftType,
  valuePct: number | null,
  capPct: number | null,
  cpi = CPI_INDIA_YOY_PCT,
): UpliftResult {
  const cap = (p: number) => (capPct == null ? p : Math.min(p, capPct));
  switch (type) {
    case "none":
      return { pct: 0, basis: "no contractual uplift" };
    case "fixed":
      return { pct: cap(valuePct ?? 0), basis: `fixed ${fmtPct(valuePct ?? 0)}` };
    case "cpi":
      return capPct == null
        ? { pct: cpi, basis: `CPI ${fmtPct(cpi)}` }
        : { pct: cap(cpi), basis: `CPI ${fmtPct(cpi)} capped at ${fmtPct(capPct)}` };
    case "greater_of": {
      const g = Math.max(valuePct ?? 0, cpi);
      const basis = `greater of ${fmtPct(valuePct ?? 0)} and CPI ${fmtPct(cpi)}`;
      return { pct: cap(g), basis: capPct == null ? basis : `${basis}, capped at ${fmtPct(capPct)}` };
    }
    case "discretionary":
      return capPct == null
        ? { pct: null, basis: "vendor discretion, no cap" }
        : { pct: capPct, basis: `vendor discretion up to cap ${fmtPct(capPct)}` };
  }
}

export const pctOf = (amount: number, pct: number) => Math.round((amount * pct) / 100);

export function toInr(amount: number, currency: string, usdInr: number = FX.USD_INR): number {
  if (currency === "INR") return amount;
  if (currency === "USD") return Math.round(amount * usdInr);
  throw new Error(`No FX rate for ${currency}`);
}

export const monthly = (annualInr: number) => Math.round(annualInr / 12);

/** F3 maths: vendor quote vs the contract's cap. */
export function quoteVsCap(annualInr: number, proposedPct: number, capPct: number) {
  const proposedAnnualInr = annualInr + pctOf(annualInr, proposedPct);
  const maxAnnualAtCapInr = annualInr + pctOf(annualInr, capPct);
  return { proposedAnnualInr, maxAnnualAtCapInr, excessOverCapInr: proposedAnnualInr - maxAnnualAtCapInr };
}
