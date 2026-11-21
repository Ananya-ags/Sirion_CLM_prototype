import { FilePlus2 } from "lucide-react";
import { EmptyState } from "@/components/docket/EmptyState";

export default function Page() {
  return (
    <EmptyState
      icon={FilePlus2}
      tag="Placeholder"
      title="Add a contract"
      description="Upload a contract to see live extraction with citations and confidence."
    />
  );
}
