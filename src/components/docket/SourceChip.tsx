import { BookText, FileSpreadsheet, FolderOpen, Mail, Signature, type LucideIcon } from "lucide-react";
import type { SourceKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Hint } from "./Hint";

const SOURCE_META: Record<SourceKind, { label: string; icon: LucideIcon; className: string }> = {
  email: { label: "Email", icon: Mail, className: "bg-src-email-bg text-src-email" },
  sharepoint: { label: "SharePoint", icon: FolderOpen, className: "bg-src-sharepoint-bg text-src-sharepoint" },
  docusign: { label: "DocuSign", icon: Signature, className: "bg-src-docusign-bg text-src-docusign" },
  tracker: { label: "Tracker", icon: FileSpreadsheet, className: "bg-src-tracker-bg text-src-tracker" },
  ledger: { label: "Ledger", icon: BookText, className: "bg-src-ledger-bg text-src-ledger" },
};

export function SourceChip({ source, detail, className }: { source: SourceKind; detail?: string; className?: string }) {
  const m = SOURCE_META[source];
  const Icon = m.icon;
  return (
    <Hint content={detail}>
      <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium", m.className, className)}>
        <Icon className="size-3.5" />
        {m.label}
      </span>
    </Hint>
  );
}
