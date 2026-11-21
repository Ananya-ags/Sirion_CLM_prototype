import { CircleCheck, CircleAlert, OctagonAlert, ScanSearch } from "lucide-react";
import type { Lane } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Hint } from "./Hint";

export const LANE_META: Record<Lane, { label: string; hint: string; icon: typeof CircleCheck; className: string }> = {
  green: {
    label: "Green",
    hint: "No material flags, under the category value limit, all key fields ≥ 85% confidence. Auto-logged; reversible until act-by minus 7 days.",
    icon: CircleCheck,
    className: "bg-lane-green-bg text-lane-green ring-lane-green/20",
  },
  amber: {
    label: "Amber",
    hint: "Minor flags only. Budget owner confirms with one click and a reason.",
    icon: CircleAlert,
    className: "bg-lane-amber-bg text-lane-amber ring-lane-amber/25",
  },
  red: {
    label: "Red",
    hint: "Material flag, ledger issue or ≤ 14 days to act-by. Procurement decides; auto-renewal not allowed.",
    icon: OctagonAlert,
    className: "bg-lane-red-bg text-lane-red ring-lane-red/20",
  },
  needs_review: {
    label: "Needs review",
    hint: "A key field is unclear or below 85% confidence. A human confirms it before any lane is set.",
    icon: ScanSearch,
    className: "bg-lane-review-bg text-lane-review ring-lane-review/20",
  },
};

export function LaneBadge({ lane, className }: { lane: Lane; className?: string }) {
  const m = LANE_META[lane];
  const Icon = m.icon;
  return (
    <Hint content={m.hint}>
      <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset", m.className, className)}>
        <Icon className="size-3.5" />
        {m.label}
      </span>
    </Hint>
  );
}
