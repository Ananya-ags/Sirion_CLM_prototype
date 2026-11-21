"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { PERSONAS } from "@/lib/config";
import { syncPersonaFromRoute } from "@/lib/personaSync";
import { useDocketStore } from "@/store/useDocketStore";

/**
 * The URL is authoritative: on load and on every navigation (sidebar, back/forward, deep links, the tour),
 * set the persona from the route. Reacts to route changes only (not to persona changes), and never navigates,
 * so it can't loop with the persona menu.
 */
export function RouteSync() {
  const pathname = usePathname();
  const as = useSearchParams().get("as");

  useEffect(() => {
    const run = () => {
      const s = useDocketStore.getState();
      const changed = syncPersonaFromRoute(pathname, as, { getPersona: () => s.persona, setPersona: s.setPersona });
      if (changed) toast(`Now viewing as ${PERSONAS[changed].name} · ${PERSONAS[changed].role}`, { id: "persona-switch", duration: 2500 });
    };
    // Wait for the persisted state, or the stored persona would overwrite the route's.
    if (useDocketStore.persist.hasHydrated()) run();
    else return useDocketStore.persist.onFinishHydration(run);
  }, [pathname, as]);

  return null;
}
