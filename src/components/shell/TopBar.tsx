"use client";

import { CalendarDays, Plus, RotateCcw } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const title = navForPath(pathname)?.label ?? "Docket";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b bg-white/85 px-8 backdrop-blur">
      <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-2.5">
        <Hint content="Demo clock is fixed so every date in the case is reproducible.">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-medium text-brand-strong">
            <CalendarDays className="size-3.5" />
            Today · {DEMO_TODAY_LABEL}
          </span>
        </Hint>
        <Hint content="v2: intake for brand-new purchases. v1 raises renewal requests for existing contracts automatically.">
          <Button variant="outline" disabled>
            <Plus />
            New request (coming next)
          </Button>
        </Hint>
        <Button
          variant="ghost"
          onClick={() => {
            resetDemo();
            router.push(PERSONAS.procurement.home);
            toast.success("Demo reset", { description: "Requests, audit log and persona restored." });
          }}
        >
          <RotateCcw />
          Reset demo
        </Button>
        <PersonaSwitcher />
      </div>
    </header>
  );
}
