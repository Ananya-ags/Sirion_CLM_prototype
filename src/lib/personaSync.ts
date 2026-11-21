/**
 * Two-way page ↔ persona sync, as pure functions (no React, no router) so the no-loop rule is testable.
 *  - Route → persona: only ever sets the persona, never navigates; a no-op when it already matches.
 *  - Persona menu → page: on a persona-owned page, navigate to the chosen persona's home and let the route set
 *    the persona; on a neutral page, set the persona and stay put.
 */
import { homeOf, isNeutralRoute, personaFromUrl } from "./nav";
import type { PersonaId } from "./types";

type PersonaStore = { getPersona: () => PersonaId; setPersona: (p: PersonaId) => void };

/** Returns the new persona when it changed, else null. Never navigates. */
export function syncPersonaFromRoute(pathname: string, as: string | null | undefined, store: PersonaStore): PersonaId | null {
  const target = personaFromUrl(pathname, as);
  if (!target || target === store.getPersona()) return null;
  store.setPersona(target);
  return target;
}

/** Explicit persona-menu choice: the only place that navigates because of a persona change. */
export function choosePersona(persona: PersonaId, pathname: string, deps: PersonaStore & { navigate: (href: string) => void }): void {
  if (isNeutralRoute(pathname)) {
    deps.setPersona(persona);
    return;
  }
  const home = homeOf(persona);
  if (home === pathname) deps.setPersona(persona);
  else deps.navigate(home); // the route sync sets the persona on arrival
}
