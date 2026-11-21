import { FLAGS } from "@/lib/flags";
import type { Flag } from "@/lib/types";
import { FlagChip } from "./FlagChip";
import { Hint } from "./Hint";

/** At most `max` chips; the rest collapse into "+N" with the list on hover. F1 (auto-renews) is implied by the act-by column. */
export function FlagChips({ flags, max = 3, hideF1 = true }: { flags: Flag[]; max?: number; hideF1?: boolean }) {
  const fs = flags.filter((f) => !hideF1 || f.code !== "F1");
  if (!fs.length) return <span className="text-xs text-muted-foreground">None</span>;
  const shown = fs.slice(0, max);
  const rest = fs.slice(max);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((f) => <FlagChip key={f.code} code={f.code} detail={f.detail} />)}
      {rest.length > 0 && (
        <Hint content={rest.map((f) => `${f.code} · ${FLAGS[f.code].label}`).join("\n")}>
          <span className="inline-flex h-6 items-center rounded-full bg-surface-2 px-2 text-xs font-semibold text-brand-strong">+{rest.length}</span>
        </Hint>
      )}
    </div>
  );
}
