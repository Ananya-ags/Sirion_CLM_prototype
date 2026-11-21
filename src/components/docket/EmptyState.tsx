import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tag,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Small pill above the title, e.g. "Coming in Phase 2". */
  tag?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-surface/60 px-6 py-16 text-center", className)}>
      <div className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-brand shadow-soft">
        <Icon className="size-6" />
      </div>
      {tag && <span className="mt-4 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-brand-strong">{tag}</span>}
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
