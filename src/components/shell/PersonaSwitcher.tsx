"use client";

import { Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PERSONA_ORDER, PERSONAS } from "@/lib/config";
import { choosePersona } from "@/lib/personaSync";
import { cn } from "@/lib/utils";
import { useDocketStore } from "@/store/useDocketStore";

/**
 * Prominent, labelled "Viewing as" control. Choosing someone opens their home page (the route then sets the
 * persona); on neutral pages (guide, evals, contract file) it switches in place.
 */
export function PersonaSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const persona = useDocketStore((s) => s.persona);
  const setPersona = useDocketStore((s) => s.setPersona);
  const current = PERSONAS[persona];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-tour="persona"
        className="flex items-center gap-3 rounded-xl border-2 border-brand/25 bg-white py-1.5 pr-3 pl-1.5 shadow-soft transition-colors outline-none hover:border-brand/50 hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Avatar className="size-9">
          <AvatarFallback className="bg-hero-gradient text-sm font-semibold text-white">{current.initials}</AvatarFallback>
        </Avatar>
        <div className="text-left leading-tight whitespace-nowrap">
          <div className="text-xs font-medium text-muted-foreground">Viewing as · switch employee</div>
          <div className="text-base font-semibold text-navy">
            {current.name} <span className="hidden font-normal text-slate-600 xl:inline">· {current.role}</span>
          </div>
        </div>
        <ChevronDown className="size-4 text-brand" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-1.5">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch employee: each sees their own screens</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PERSONA_ORDER.map((id) => {
          const p = PERSONAS[id];
          const active = id === persona;
          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => choosePersona(id, pathname, { getPersona: () => persona, setPersona, navigate: (href) => router.push(href) })}
              className={cn("items-start gap-3 rounded-lg p-2.5", active && "bg-surface-2")}
            >
              <Avatar className="mt-0.5 size-8">
                <AvatarFallback className={cn("text-xs font-semibold", active ? "bg-hero-gradient text-white" : "bg-surface-2 text-brand-strong")}>{p.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 leading-snug">
                <div className="text-sm font-semibold text-navy">
                  {p.name} <span className="font-normal text-slate-600">· {p.role}</span>
                </div>
                <div className="text-xs text-slate-600">{p.does}</div>
              </div>
              {active && <Check className="mt-1 size-4 text-brand" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
