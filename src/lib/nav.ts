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

/**
 * Single source of truth for pages ↔ personas.
 * A persona-owned route sets the persona (the URL is authoritative); neutral routes keep whoever is current.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Owning persona; null = neutral (no persona change). */
  persona: PersonaId | null;
};

/** Each persona's sidebar items, in order. The first item is the persona's home route. */
export const PERSONA_NAV: Record<PersonaId, NavItem[]> = {
  procurement: [
    { href: "/inbox", label: "Inbox", icon: Inbox, persona: "procurement" },
    { href: "/policy", label: "Policy", icon: SlidersHorizontal, persona: "procurement" },
    { href: "/add-contract", label: "Add a contract", icon: FilePlus2, persona: "procurement" },
  ],
  owner: [{ href: "/requests", label: "Requests", icon: ListChecks, persona: "owner" }],
  legal: [{ href: "/legal", label: "Legal queue", icon: Scale, persona: "legal" }],
  finance: [{ href: "/finance", label: "Finance alerts", icon: Receipt, persona: "finance" }],
};

/** "For evaluators": neutral. */
export const EVALUATOR_NAV: NavItem[] = [
  { href: "/brief", label: "Prototype Guide & Case Brief", icon: BookOpen, persona: null },
  { href: "/evals", label: "Evals & Guardrails", icon: FlaskConical, persona: null },
];

/** Linked from the sidebar footer; neutral. */
export const DESIGN_NAV: NavItem = { href: "/design", label: "Design system", icon: Palette, persona: null };

/** Shared contract view (opened from the inbox, not listed): neutral; actions on it stay persona-gated. */
export const CONTRACT_NAV: NavItem = { href: "/contracts", label: "Contract file", icon: FileText, persona: null };

export const ALL_NAV: NavItem[] = [...Object.values(PERSONA_NAV).flat(), ...EVALUATOR_NAV, DESIGN_NAV, CONTRACT_NAV];

const PERSONA_IDS = Object.keys(PERSONA_NAV) as PersonaId[];

export function homeOf(persona: PersonaId): string {
  return PERSONA_NAV[persona][0].href;
}

export function navForPath(pathname: string): NavItem | undefined {
  return ALL_NAV.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
}

/** Owning persona of a route, or null when the route is neutral (or unknown). */
export function personaForRoute(pathname: string): PersonaId | null {
  return navForPath(pathname)?.persona ?? null;
}

export function isNeutralRoute(pathname: string): boolean {
  return personaForRoute(pathname) === null;
}

/**
 * Persona the URL asks for: the route's owner; on a neutral route, an optional `?as=<persona>`
 * (used by deep links and the guided tour to put a given persona on a shared page); otherwise null (keep current).
 */
export function personaFromUrl(pathname: string, as?: string | null): PersonaId | null {
  const owner = personaForRoute(pathname);
  if (owner) return owner;
  return as && (PERSONA_IDS as string[]).includes(as) ? (as as PersonaId) : null;
}
