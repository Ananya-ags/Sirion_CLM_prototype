import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/docket/EmptyState";

export default function Page() {
  return (
    <EmptyState
      icon={Inbox}
      tag="Placeholder"
      title="Nothing in the inbox yet"
      description="Renewal requests Docket raises itself will land here, sorted by act-by date."
    />
  );
}
