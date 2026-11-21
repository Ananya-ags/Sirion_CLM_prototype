import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Wraps any inline element with a tooltip. Keeps on-screen text minimal. */
export function Hint({ content, children }: { content?: ReactNode; children: ReactNode }) {
  if (!content) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-xs leading-snug whitespace-pre-line">{content}</TooltipContent>
    </Tooltip>
  );
}
