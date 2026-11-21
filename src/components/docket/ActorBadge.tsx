import { Cog, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { PERSONAS } from "@/lib/config";
import type { Actor, ActorKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Hint } from "./Hint";

const ACTOR_META: Record<ActorKind, { icon: LucideIcon; hint: string; className: string }> = {
  AI: { icon: Sparkles, hint: "AI (Claude): reads, classifies, extracts with citations, drafts wording. Never does maths, never sends.", className: "bg-actor-ai-bg text-actor-ai" },
  Rules: { icon: Cog, hint: "Rules (deterministic TypeScript): dates, ₹ maths, FX, benchmarks, ledger checks, lanes and routing.", className: "bg-actor-rules-bg text-actor-rules" },
  Human: { icon: UserRound, hint: "Human: confirms low-confidence fields, decides, approves and sends.", className: "bg-actor-human-bg text-actor-human" },
};

export function actorKind(actor: Actor): ActorKind {
  return actor === "AI" || actor === "Rules" ? actor : "Human";
}

/** Pass "AI", "Rules", "Human", or a persona id (renders as Human with the persona's name). */
export function ActorBadge({ actor, className }: { actor: Actor | "Human"; className?: string }) {
  const kind = actor === "Human" ? "Human" : actorKind(actor);
  const m = ACTOR_META[kind];
  const Icon = m.icon;
  const label = kind === "Human" && actor !== "Human" ? PERSONAS[actor as keyof typeof PERSONAS].name : kind;
  return (
    <Hint content={m.hint}>
      <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-xs font-semibold", m.className, className)}>
        <Icon className="size-3" />
        {label}
      </span>
    </Hint>
  );
}
