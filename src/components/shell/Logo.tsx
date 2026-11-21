import { Layers } from "lucide-react";

export function Logo() {
  return (
    <div className="px-2">
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-hero-gradient shadow-lift">
          <Layers className="size-6 text-white" strokeWidth={2.25} />
        </div>
        <span className="text-[1.75rem] leading-none font-semibold tracking-tight text-white">Docket</span>
      </div>
      <p className="mt-3 text-sm leading-snug text-sidebar-foreground/85">Every renewal caught. Only the risky ones need you.</p>
    </div>
  );
}
