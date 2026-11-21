import { Layers } from "lucide-react";

export function Logo() {
  return (
    <div className="px-2">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 place-items-center rounded-lg bg-hero-gradient shadow-lift">
          <Layers className="size-4.5 text-white" strokeWidth={2.25} />
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">Docket</span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-sidebar-foreground/60">
        Every renewal caught. Only the risky ones need you.
      </p>
    </div>
  );
}
