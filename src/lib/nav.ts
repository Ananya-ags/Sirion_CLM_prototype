import {
  BookOpen,
  FilePlus2,
  FileText,
  FlaskConical,
  Inbox,
  ListChecks,
  type LucideIcon,
  Palette,
  Receipt,
  Scale,
  SlidersHorizontal,
} from "lucide-react";
import type { PersonaId } from "./types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Personas that see this item. "all" = evaluator tabs, always visible. */
  personas: PersonaId[] | "all";
  group: "work" | "evaluator";
};

export const NAV: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox, personas: ["procurement"], group: "work" },
  { href: "/requests", label: "Requests", icon: ListChecks, personas: ["procurement", "owner"], group: "work" },
  { href: "/legal", label: "Legal queue", icon: Scale, personas: ["procurement", "legal"], group: "work" },
  { href: "/finance", label: "Finance alerts", icon: Receipt, personas: ["procurement", "finance"], group: "work" },
  { href: "/add-contract", label: "Add a contract", icon: FilePlus2, personas: ["procurement"], group: "work" },
  { href: "/policy", label: "Policy", icon: SlidersHorizontal, personas: ["procurement"], group: "work" },
  { href: "/brief", label: "Case Brief", icon: BookOpen, personas: "all", group: "evaluator" },
  { href: "/evals", label: "Evals & Guardrails", icon: FlaskConical, personas: "all", group: "evaluator" },
];

/** Not in the sidebar list proper; linked from the sidebar footer. */
export const DESIGN_NAV: NavItem = {
  href: "/design",
  label: "Design system",
  icon: Palette,
  personas: "all",
  group: "evaluator",
};

/** Contract file: opened from the inbox, not listed in the sidebar. */
export const CONTRACT_NAV: NavItem = { href: "/contracts", label: "Contract file", icon: FileText, personas: "all", group: "work" };

export function canSee(item: NavItem, persona: PersonaId): boolean {
  return item.personas === "all" || item.personas.includes(persona);
}

export function navForPath(pathname: string): NavItem | undefined {
  return [...NAV, DESIGN_NAV, CONTRACT_NAV].find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
}
