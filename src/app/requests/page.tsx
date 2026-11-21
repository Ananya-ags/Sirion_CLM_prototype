import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/docket/EmptyState";

export default function Page() {
  return (
    <EmptyState
      icon={ListChecks}
      tag="Placeholder"
      title="No renewal requests yet"
      description="Pre-filled renewal requests for budget owners: two questions, plain-language flags."
    />
  );
}
