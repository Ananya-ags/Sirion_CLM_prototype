"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { PERSONA_ORDER, PERSONAS } from "@/lib/config";
import { DESIGN_NAV, EVALUATOR_NAV, PERSONA_NAV, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useDocketStore } from "@/store/useDocketStore";
import { Logo } from "./Logo";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-white shadow-[0_4px_14px_rgb(37_99_235/0.35)]"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-white" : "text-sidebar-foreground/70 group-hover:text-white")} />
      {item.label}
    </Link>
  );
}

/**
 * Sidebar grouped by persona. Clicking an item in another persona's group navigates there and the route switches
 * the persona (see RouteSync). "For evaluators" is neutral.
 */
export function Sidebar() {
  const pathname = usePathname();
  const persona = useDocketStore((s) => s.persona);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col overflow-y-auto bg-sidebar px-3 py-6">
      <Logo />
      <nav className="mt-6 flex flex-1 flex-col gap-1.5" aria-label="Main">
        {PERSONA_ORDER.map((id) => {
          const p = PERSONAS[id];
          const current = id === persona;
          return (
            <div
              key={id}
              data-persona-group={id}
              data-current={current || undefined}
              className={cn(
                "rounded-xl p-1.5 transition-colors",
                current ? "bg-[#EAF2FF]/12 ring-1 ring-[#EAF2FF]/20" : "opacity-60 hover:opacity-100",
              )}
            >
              <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-1">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold",
                    current ? "bg-hero-gradient text-white" : "bg-white/10 text-sidebar-foreground",
                  )}
                >
                  {p.initials}
                </span>
                <span className={cn("truncate text-[0.8125rem]", current ? "font-bold text-white" : "font-medium text-sidebar-foreground")}>
                  {p.name} · {p.role}
                </span>
              </div>
              {PERSONA_NAV[id].map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          );
        })}
        <Separator className="my-2 bg-sidebar-border" />
        <div data-tour="evaluators" className="evaluator-glow mx-1 mb-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold tracking-wide text-yellow-100">
          <Sparkle className="size-4 text-yellow-300" /> For evaluators
        </div>
        {EVALUATOR_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>
      <Link href={DESIGN_NAV.href} className="mt-4 px-3 text-xs text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground">
        Velora Consumer · {DESIGN_NAV.label}
      </Link>
    </aside>
  );
}
