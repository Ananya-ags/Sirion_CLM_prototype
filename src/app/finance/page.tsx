import { FinanceView } from "@/components/screens/FinanceView";
import { getPortfolio } from "@/lib/portfolio";

export default async function Page() {
  const { views } = await getPortfolio();
  return <FinanceView views={views} />;
}
