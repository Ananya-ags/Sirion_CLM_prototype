"use client";

import { ChevronDown } from "lucide-react";
import { Collapsible } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One consistent expandable section: header row (title left, optional summary, chevron right that rotates when open),
 * smooth height animation, keyboard accessible (the trigger is a <button>: Enter / Space, aria-expanded).
 */
export function Expandable({
  title,
  summary,
  defaultOpen = false,
  id,
  className,
  triggerClassName,
  contentClassName,
  children,
}: {
  title: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Collapsible.Root defaultOpen={defaultOpen} id={id} className={className}>
      <Collapsible.Trigger
        data-slot="expandable-trigger"
        className={cn(
          "group flex w-full cursor-pointer items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2",
          triggerClassName,
        )}
      >
        <span className="min-w-0 flex-1">{title}</span>
        {summary && <span className="shrink-0 text-[0.8125rem] font-medium text-slate-500">{summary}</span>}
        <ChevronDown aria-hidden className="size-5 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </Collapsible.Trigger>
      <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className={contentClassName}>{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
