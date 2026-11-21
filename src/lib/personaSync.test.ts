import { describe, expect, it, vi } from "vitest";
import { homeOf, isNeutralRoute, personaForRoute, personaFromUrl, PERSONA_NAV } from "./nav";
import { choosePersona, syncPersonaFromRoute } from "./personaSync";
import type { PersonaId } from "./types";

/** A tiny persona store + router that mimics the app: navigation triggers the route sync, as RouteSync does. */
function harness(start: PersonaId, path: string) {
  const state = { persona: start, path };
  const setPersona = vi.fn((p: PersonaId) => {
    state.persona = p;
  });
  const navigate = vi.fn((href: string) => {
    state.path = href;
    syncPersonaFromRoute(href, null, store);
  });
  const store = { getPersona: () => state.persona, setPersona };
  return { state, store, setPersona, navigate };
}

describe("route → persona map", () => {
  it.each([
    ["/inbox", "procurement"],
    ["/policy", "procurement"],
    ["/add-contract", "procurement"],
    ["/requests", "owner"],
    ["/legal", "legal"],
    ["/finance", "finance"],
  ] as const)("%s belongs to %s", (path, persona) => {
    expect(personaForRoute(path)).toBe(persona);
    expect(isNeutralRoute(path)).toBe(false);
  });

  it.each(["/brief", "/evals", "/design", "/contracts/SUP-09", "/somewhere-else"])("%s is neutral", (path) => {
    expect(personaForRoute(path)).toBeNull();
    expect(isNeutralRoute(path)).toBe(true);
  });

  it("home route is each persona's first item", () => {
    expect(homeOf("procurement")).toBe("/inbox");
    expect(homeOf("owner")).toBe("/requests");
    expect(homeOf("legal")).toBe("/legal");
    expect(homeOf("finance")).toBe("/finance");
    for (const [p, items] of Object.entries(PERSONA_NAV)) for (const i of items) expect(personaForRoute(i.href)).toBe(p);
  });

  it("?as= picks a persona only on neutral routes, and only a valid one", () => {
    expect(personaFromUrl("/contracts/SUP-09", "procurement")).toBe("procurement");
    expect(personaFromUrl("/contracts/SUP-09", "nobody")).toBeNull();
    expect(personaFromUrl("/contracts/SUP-09", null)).toBeNull();
    expect(personaFromUrl("/legal", "owner")).toBe("legal"); // owned route wins
  });
});

describe("no loop: route-driven sync never navigates", () => {
  it("sets the persona once when it differs, then is a no-op", () => {
    const h = harness("procurement", "/legal");
    expect(syncPersonaFromRoute("/legal", null, h.store)).toBe("legal");
    expect(syncPersonaFromRoute("/legal", null, h.store)).toBeNull();
    expect(h.setPersona).toHaveBeenCalledTimes(1);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("neutral routes keep the current persona", () => {
    const h = harness("finance", "/brief");
    for (const p of ["/brief", "/evals", "/design", "/contracts/SUP-01"]) expect(syncPersonaFromRoute(p, null, h.store)).toBeNull();
    expect(h.state.persona).toBe("finance");
    expect(h.setPersona).not.toHaveBeenCalled();
  });

  it("persona menu on an owned page navigates once; the route then sets the persona once; nothing repeats", () => {
    const h = harness("procurement", "/inbox");
    choosePersona("legal", h.state.path, { ...h.store, navigate: h.navigate });
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith("/legal");
    expect(h.setPersona).toHaveBeenCalledTimes(1);
    expect(h.state).toEqual({ persona: "legal", path: "/legal" });
    // Re-running the sync (e.g. a re-render) changes nothing and never navigates.
    syncPersonaFromRoute(h.state.path, null, h.store);
    expect(h.navigate).toHaveBeenCalledTimes(1);
    expect(h.setPersona).toHaveBeenCalledTimes(1);
  });

  it("persona menu on a neutral page switches in place without navigating", () => {
    const h = harness("procurement", "/contracts/SUP-09");
    choosePersona("owner", h.state.path, { ...h.store, navigate: h.navigate });
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.state).toEqual({ persona: "owner", path: "/contracts/SUP-09" });
  });
});
