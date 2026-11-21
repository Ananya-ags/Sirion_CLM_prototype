import { LegalView } from "@/components/screens/LegalView";
import { getPortfolio } from "@/lib/portfolio";

export default async function Page() {
  const { views } = await getPortfolio();
  return <LegalView views={views} />;
}
