"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { canSee, DESIGN_NAV, NAV, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { useDocketStore } from "@/store/useDocketStore";
import { Logo } from "./Logo";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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

export function Sidebar() {
  const pathname = usePathname();
  const persona = useDocketStore((s) => s.persona);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const work = NAV.filter((n) => n.group === "work" && canSee(n, persona));
  const evaluator = NAV.filter((n) => n.group === "evaluator");

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-sidebar px-3 py-6">
      <Logo />
      <nav className="mt-7 flex flex-1 flex-col gap-0.5">
        {work.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <Separator className="my-3 bg-sidebar-border" />
        <div data-tour="evaluators" className="evaluator-glow mx-1 mb-1.5 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold tracking-wide text-yellow-100">
          <Sparkle className="size-4 text-yellow-300" /> For evaluators
        </div>
        {evaluator.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>
      <Link
        href={DESIGN_NAV.href}
        className="px-3 text-xs text-sidebar-foreground/55 transition-colors hover:text-sidebar-foreground"
      >
        Velora Consumer · {DESIGN_NAV.label}
      </Link>
    </aside>
  );
}
