import { STATE_LABEL } from "@/lib/labels";
import type { RequestState } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE: Partial<Record<RequestState, string>> = {
  sent: "bg-lane-green-bg text-lane-green",
  renewed_logged: "bg-lane-green-bg text-lane-green",
  auto_logged: "bg-lane-green-bg text-lane-green",
  closed: "bg-lane-green-bg text-lane-green",
  legal_pending: "bg-src-docusign-bg text-src-docusign",
  procurement_review: "bg-surface-2 text-brand-strong",
  handoff_renegotiation: "bg-src-tracker-bg text-src-tracker",
};

export function StateChip({ state, className }: { state: RequestState; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap", TONE[state] ?? "bg-muted text-muted-foreground ring-1 ring-border ring-inset", className)}>
      {STATE_LABEL[state]}
    </span>
  );
}
