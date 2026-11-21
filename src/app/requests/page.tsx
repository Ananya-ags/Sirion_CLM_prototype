import { RequestsView } from "@/components/screens/RequestsView";
import { getPortfolio } from "@/lib/portfolio";

export default async function Page() {
  const { views } = await getPortfolio();
  return <RequestsView views={views} />;
}
