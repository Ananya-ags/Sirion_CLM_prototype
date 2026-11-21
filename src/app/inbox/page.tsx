import { InboxView } from "@/components/screens/InboxView";
import { getPortfolio } from "@/lib/portfolio";

export default async function Page() {
  const { views, unmatched, sources } = await getPortfolio();
  return <InboxView views={views} unmatched={unmatched} sources={sources} />;
}
