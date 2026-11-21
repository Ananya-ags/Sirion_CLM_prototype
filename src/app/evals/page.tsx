import { FlaskConical } from "lucide-react";
import { EmptyState } from "@/components/docket/EmptyState";

export default function Page() {
  return (
    <EmptyState
      icon={FlaskConical}
      tag="Placeholder"
      title="Evals & guardrails"
      description="Extraction accuracy on held-out contracts, plus the guardrails every draft passes."
    />
  );
}
