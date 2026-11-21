import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContractView } from "@/components/screens/ContractView";
import { getPortfolio, viewById } from "@/lib/portfolio";

export async function generateStaticParams() {
  const { views } = await getPortfolio();
  return views.map((v) => ({ supplierId: v.supplierId }));
}

/** params is read inside Suspense so navigation stays instant (Cache Components). */
export default function Page({ params }: PageProps<"/contracts/[supplierId]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-surface" />}>
      <Contract params={params} />
    </Suspense>
  );
}

async function Contract({ params }: { params: PageProps<"/contracts/[supplierId]">["params"] }) {
  const { supplierId } = await params;
  const view = viewById(await getPortfolio(), supplierId);
  if (!view) notFound();
  return <ContractView view={view} />;
}
