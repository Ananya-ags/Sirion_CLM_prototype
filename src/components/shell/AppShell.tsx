import { Suspense, type ReactNode } from "react";
import { getPortfolio } from "@/lib/portfolio";
import { RouteSync } from "./RouteSync";
import { Sidebar } from "./Sidebar";
import { StoreHydrator } from "./StoreHydrator";
import { TopBar } from "./TopBar";
import { Tour } from "@/components/tour/Tour";

export async function AppShell({ children }: { children: ReactNode }) {
  const { requests: initialRequests } = await getPortfolio();
  return (
    <div className="flex min-h-screen">
      <StoreHydrator initialRequests={initialRequests} />
      <Suspense fallback={null}>
        <RouteSync />
      </Suspense>
      <Tour />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-surface/70 to-white">
        <TopBar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
