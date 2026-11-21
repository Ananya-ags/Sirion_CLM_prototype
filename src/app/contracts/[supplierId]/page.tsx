import { notFound } from "next/navigation";
import { ContractView } from "@/components/screens/ContractView";
import { getPortfolio, viewById } from "@/lib/portfolio";

export async function generateStaticParams() {
  const { views } = await getPortfolio();
  return views.map((v) => ({ supplierId: v.supplierId }));
}

export default async function Page({ params }: PageProps<"/contracts/[supplierId]">) {
  const { supplierId } = await params;
  const view = viewById(await getPortfolio(), supplierId);
  if (!view) notFound();
  return <ContractView view={view} />;
}
