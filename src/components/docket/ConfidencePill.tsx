import { TriangleAlert } from "lucide-react";
import { CONFIDENCE_THRESHOLD } from "@/lib/config";
import { cn } from "@/lib/utils";
import { Hint } from "./Hint";

/** Shows extraction confidence. Below 85% (or "unclear") it reads as needing human review. */
export function ConfidencePill({ value, unclear, className }: { value: number; unclear?: boolean; className?: string }) {
  const pct = Math.round(value * 100);
  if (unclear) {
    return (
      <Hint content="The AI could not read this field with confidence. A human must confirm it.">
        <span className={cn("inline-flex h-5 items-center gap-1 rounded-full border border-dashed border-lane-review/40 px-2 text-xs font-medium text-lane-review", className)}>
          <TriangleAlert className="size-3" />
          Unclear
        </span>
      </Hint>
    );
  }
  const low = value < CONFIDENCE_THRESHOLD;
  return (
    <Hint content={low ? `Below the ${CONFIDENCE_THRESHOLD * 100}% threshold: sent to human review.` : "Extraction confidence"}>
      <span
        className={cn(
          "inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium tabular-nums",
          low ? "bg-lane-review-bg text-lane-review" : "bg-surface-2 text-brand-strong",
          className,
        )}
      >
        {low ? (
          <TriangleAlert className="size-3" />
        ) : (
          <span className="relative h-1 w-6 overflow-hidden rounded-full bg-brand/15">
            <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </span>
        )}
        {pct}%
      </span>
    </Hint>
  );
}
