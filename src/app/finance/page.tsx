import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/docket/EmptyState";

export default function Page() {
  return (
    <EmptyState
      icon={Receipt}
      tag="Placeholder"
      title="No billing alerts yet"
      description="Ledger-vs-contract checks. Confirming an alert attaches it as evidence to Procurement's card."
    />
  );
}
