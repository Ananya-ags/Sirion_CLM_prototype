"use client";

import { CalendarDays, Compass, Plus, RotateCcw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTour } from "@/components/tour/tourStore";
import { Hint } from "@/components/docket/Hint";
import { Button } from "@/components/ui/button";
import { DEMO_TODAY_LABEL, PERSONAS } from "@/lib/config";
import { navForPath } from "@/lib/nav";
import { useDocketStore } from "@/store/useDocketStore";
import { PersonaSwitcher } from "./PersonaSwitcher";

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const resetDemo = useDocketStore((s) => s.resetDemo);
  const openWelcome = useTour((s) => s.openWelcome);
  const title = navForPath(pathname)?.label ?? "Docket";

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-4 border-b bg-white/90 px-8 backdrop-blur">
      <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-2">
        <Hint content="Demo clock is fixed so every date in the case is reproducible.">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-medium text-brand-strong">
            <CalendarDays className="size-4" />
            {DEMO_TODAY_LABEL}
          </span>
        </Hint>
        <Hint content="New request (coming next): intake for brand-new purchases. Today Docket raises renewal requests itself.">
          <span>
            <Button variant="outline" disabled aria-label="New request (coming next)">
              <Plus /> New request <span className="rounded bg-surface-2 px-1 text-xs text-brand-strong">soon</span>
            </Button>
          </span>
        </Hint>
        <Button variant="outline" onClick={openWelcome} data-tour="tour-button"><Compass /> Tour</Button>
        <Hint content="Restore requests, audit log, drafts and persona.">
          <Button
            variant="ghost"
            onClick={() => {
              resetDemo();
              router.push(PERSONAS.procurement.home);
              toast.success("Demo reset");
            }}
          >
            <RotateCcw /> Reset
          </Button>
        </Hint>
        <PersonaSwitcher />
      </div>
    </header>
  );
}
