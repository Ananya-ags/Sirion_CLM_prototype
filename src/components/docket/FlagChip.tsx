import { FLAGS } from "@/lib/flags"; // derived from lib/flags-catalog.ts (single source)
import type { FlagCode, FlagSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Hint } from "./Hint";

const DOT: Record<FlagSeverity, string> = {
  material: "bg-lane-red",
  minor: "bg-lane-amber",
  review: "bg-lane-review",
  info: "bg-brand",
};

/** Code + short label; the tooltip carries the detail. */
export function FlagChip({
  code,
  detail,
  severity,
  resolved,
  className,
}: {
  code: FlagCode;
  detail?: string;
  severity?: FlagSeverity;
  resolved?: boolean;
  className?: string;
}) {
  const m = FLAGS[code];
  const sev = severity ?? m.severity;
  return (
    <Hint
      content={
        <div className="space-y-1">
          <div className="font-semibold">
            {m.code} · {m.key}
          </div>
          <div className="opacity-90">{detail ?? m.description}</div>
          {resolved && <div className="opacity-75">Resolved by a human.</div>}
        </div>
      }
    >
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium text-navy",
          resolved && "text-muted-foreground line-through decoration-muted-foreground/50",
          className,
        )}
      >
        <span className={cn("size-1.5 rounded-full", DOT[sev])} />
        <span className="font-mono text-xs text-muted-foreground">{m.code}</span>
        {m.label}
      </span>
    </Hint>
  );
}
