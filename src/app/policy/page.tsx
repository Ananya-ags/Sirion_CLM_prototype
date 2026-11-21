import { SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/docket/EmptyState";

export default function Page() {
  return (
    <EmptyState
      icon={SlidersHorizontal}
      tag="Placeholder"
      title="Category policy"
      description="Uplift thresholds, benchmark gaps, green-lane limits and payment-term policy by category."
    />
  );
}
