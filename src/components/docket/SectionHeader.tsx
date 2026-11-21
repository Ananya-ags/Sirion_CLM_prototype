import type { ReactNode } from "react";

/** Dashboard section heading: title (19px) + optional caption and right-side slot. */
export function SectionHeader({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-navy">{title}</h2>
        {caption && <p className="text-xs text-slate-500">{caption}</p>}
      </div>
      {right}
    </div>
  );
}
