"use client";

import { Lock } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/docket/EmptyState";
import { Button } from "@/components/ui/button";
import { PERSONAS } from "@/lib/config";
import { canSee, navForPath } from "@/lib/nav";
import { useDocketStore } from "@/store/useDocketStore";

/** If the current persona can't see this screen, offer to switch instead of showing it. */
export function PersonaGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const persona = useDocketStore((s) => s.persona);
  const setPersona = useDocketStore((s) => s.setPersona);
  const item = navForPath(pathname);

  if (!item || canSee(item, persona)) return <>{children}</>;

  const me = PERSONAS[persona];
  return (
    <EmptyState
      icon={Lock}
      title={`${item.label} isn't part of ${me.name}'s view`}
      description={`${me.name} (${me.role}) works from a different screen.`}
      action={
        <div className="flex gap-2">
          <Button onClick={() => router.push(me.home)}>Go to {me.name}&apos;s home</Button>
          <Button variant="outline" onClick={() => setPersona("procurement")}>
            View as Priya
          </Button>
        </div>
      }
    />
  );
}
