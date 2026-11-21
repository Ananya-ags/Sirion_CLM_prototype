import { PolicyView } from "@/components/screens/PolicyView";
import { getPortfolio } from "@/lib/portfolio";

export default async function Page() {
  const { policy } = await getPortfolio();
  return <PolicyView policy={policy} />;
}
