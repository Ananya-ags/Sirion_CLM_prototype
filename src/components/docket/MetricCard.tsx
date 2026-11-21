import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Hint } from "./Hint";

type Props = {
  label: string;
  value: string;
  sublabel?: string;
  icon?: LucideIcon;
  variant?: "default" | "gradient";
  hint?: string;
  className?: string;
};

export function MetricCard({ label, value, sublabel, icon: Icon, variant = "default", hint, className }: Props) {
  const hero = variant === "gradient";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-5",
        hero ? "bg-hero-gradient text-white shadow-lift" : "border bg-card shadow-soft",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex items-center gap-1.5 text-xs font-medium", hero ? "text-white/80" : "text-muted-foreground")}>
          {label}
          {hint && (
            <Hint content={hint}>
              <Info className="size-3.5 opacity-70" />
            </Hint>
          )}
        </div>
        {Icon && (
          <div className={cn("grid size-8 place-items-center rounded-lg", hero ? "bg-white/15" : "bg-surface-2 text-brand")}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <div className={cn("mt-2 text-3xl font-semibold tracking-tight tabular-nums", hero ? "text-white" : "text-navy")}>{value}</div>
      {sublabel && <div className={cn("mt-1 text-xs", hero ? "text-white/75" : "text-muted-foreground")}>{sublabel}</div>}
    </div>
  );
}
