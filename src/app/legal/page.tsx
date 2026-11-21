import { Scale } from "lucide-react";
import { EmptyState } from "@/components/docket/EmptyState";

export default function Page() {
  return (
    <EmptyState
      icon={Scale}
      tag="Placeholder"
      title="No notices awaiting approval"
      description="Notices and cap letters drafted from rights already in the contract. Legal approves and marks them sent."
    />
  );
}
