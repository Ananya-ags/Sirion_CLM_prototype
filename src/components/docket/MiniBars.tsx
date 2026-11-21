import { formatINR, formatINRShort } from "@/lib/format";
import { Hint } from "./Hint";

/**
 * Tiny single-series bar chart with a dashed reference line. Single series → no legend.
 * Default (billing): monthly billed vs contracted monthly value; months above contract (+tolerance) use the
 * warning status colour. Utilisation mode: % active vs the policy threshold; months BELOW it are highlighted.
 */
export function MiniBars({
  months,
  contracted,
  tolerancePct = 5,
  height = 72,
  mode = "billing",
}: {
  months: { period: string; amount: number }[];
  /** Reference value: contracted monthly ₹ (billing) or threshold % (utilisation). */
  contracted: number;
  tolerancePct?: number;
  height?: number;
  mode?: "billing" | "utilisation";
}) {
  if (!months.length) return <p className="text-xs text-muted-foreground">{mode === "billing" ? "No ledger entries." : "No usage data."}</p>;
  const util = mode === "utilisation";
  const max = util ? 100 : Math.max(...months.map((m) => m.amount), contracted) * 1.1;
  const limit = util ? contracted : contracted * (1 + tolerancePct / 100);
  const y = (v: number) => height - (v / max) * height;
  const isHot = (v: number) => contracted > 0 && (util ? v < limit : v > limit);
  const hotCount = months.filter((m) => isHot(m.amount)).length;
  const fmt = (v: number) => (util ? `${v.toFixed(1)}%` : formatINR(v));
  return (
    <figure className="space-y-1.5">
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-0.5" aria-hidden>
          {months.map((m) => (
            <Hint key={m.period} content={`${m.period}: ${fmt(m.amount)}${contracted ? ` · ${util ? "threshold" : "contract"} ${fmt(contracted)}` : ""}`}>
              <span className="flex h-full flex-1 items-end" style={{ height }}>
                <span
                  className={isHot(m.amount) ? "w-full rounded-t-[4px] bg-lane-amber" : "w-full rounded-t-[4px] bg-brand/70"}
                  style={{ height: Math.max(2, height - y(m.amount)), minWidth: 6 }}
                />
              </span>
            </Hint>
          ))}
        </div>
        {contracted > 0 && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-navy/40" style={{ top: y(contracted) }} />}
      </div>
      <figcaption className="flex justify-between text-xs text-muted-foreground">
        <span>
          {months[0].period} → {months[months.length - 1].period}
        </span>
        <span>
          {contracted > 0 ? (util ? `Dashed = ${contracted}% threshold` : `Dashed = contract ${formatINRShort(contracted)}/mo`) : "No contract value"}
          {hotCount > 0 && <span className="font-medium text-lane-amber"> · {hotCount} mo {util ? "below" : "above"}</span>}
        </span>
      </figcaption>
      <table className="sr-only">
        <tbody>
          {months.map((m) => (
            <tr key={m.period}>
              <td>{m.period}</td>
              <td>{fmt(m.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
