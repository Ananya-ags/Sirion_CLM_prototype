import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/docket/EmptyState";

export default function Page() {
  return (
    <EmptyState
      icon={BookOpen}
      tag="Placeholder"
      title="Case brief"
      description="The problem, the approach and what Docket deliberately does not do."
    />
  );
}
