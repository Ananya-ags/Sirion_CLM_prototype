import { FileScan, FileUp, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { ActorBadge, EmptyState } from "@/components/docket";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: FileUp, t: "Upload a PDF or forward an email", a: "Human" as const },
  { icon: FileScan, t: "Parse text, OCR scanned pages, strip headers", a: "AI" as const },
  { icon: Sparkles, t: "Group by CIN / GSTIN / envelope ID; extract with citations", a: "AI" as const },
  { icon: ShieldCheck, t: "Verify every quote; compute dates, ₹ and lane", a: "Rules" as const },
  { icon: ScanSearch, t: "Anything below 85% confidence → human review", a: "Human" as const },
];

export default function Page() {
  return (
    <div className="space-y-6">
      <EmptyState
        icon={FileUp}
        tag="Coming next"
        title="Add a contract"
        description="Live intake for a single contract: the same guarded pipeline the portfolio went through, run on demand."
        action={<Button disabled>Upload contract (coming next)</Button>}
      />
      <div className="grid gap-3 md:grid-cols-5">
        {STEPS.map((s, i) => (
          <div key={s.t} className="rounded-xl border bg-card p-4 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
              <ActorBadge actor={s.a} />
            </div>
            <s.icon className="mt-3 size-5 text-brand" />
            <p className="mt-2 text-sm text-navy">{s.t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
