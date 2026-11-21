import { format, parseISO } from "date-fns";

const inrFull = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹62,00,000 */
export function formatINR(amount: number): string {
  return inrFull.format(Math.round(amount));
}

function trim(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "");
}

/** ₹4.34L, ₹12.5Cr, ₹85,000 */
export function formatINRShort(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  return `${sign}${formatINR(abs)}`;
}

/** 25 Nov 2026 */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "d MMM yyyy");
}

export function formatPct(pct: number, digits = 1): string {
  return `${pct.toFixed(digits)}%`;
}
