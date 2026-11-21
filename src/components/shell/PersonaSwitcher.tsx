"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERSONA_ORDER, PERSONAS } from "@/lib/config";
import { useDocketStore } from "@/store/useDocketStore";

export function PersonaSwitcher() {
  const router = useRouter();
  const persona = useDocketStore((s) => s.persona);
  const setPersona = useDocketStore((s) => s.setPersona);
  const current = PERSONAS[persona];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl border bg-card py-1 pr-2 pl-1 shadow-soft transition-colors outline-none hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/40">
        <Avatar className="size-7">
          <AvatarFallback className="bg-surface-2 text-[11px] font-semibold text-brand-strong">{current.initials}</AvatarFallback>
        </Avatar>
        <div className="text-left leading-tight">
          <div className="text-sm font-semibold text-navy">{current.name}</div>
          <div className="text-[11px] text-muted-foreground">{current.role}</div>
        </div>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">View Docket as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PERSONA_ORDER.map((id) => {
          const p = PERSONAS[id];
          return (
            <DropdownMenuItem
              key={id}
              onSelect={() => {
                setPersona(id);
                router.push(p.home);
              }}
              className="gap-2.5"
            >
              <Avatar className="size-6">
                <AvatarFallback className="bg-surface-2 text-[10px] font-semibold text-brand-strong">{p.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 leading-tight">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">{p.role}</div>
              </div>
              {id === persona && <Check className="size-4 text-brand" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
