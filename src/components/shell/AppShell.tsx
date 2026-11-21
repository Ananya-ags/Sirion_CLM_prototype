import type { ReactNode } from "react";
import { getPortfolio } from "@/lib/portfolio";
import { PersonaGate } from "./PersonaGate";
import { Sidebar } from "./Sidebar";
import { StoreHydrator } from "./StoreHydrator";
import { TopBar } from "./TopBar";

export async function AppShell({ children }: { children: ReactNode }) {
  const { requests: initialRequests } = await getPortfolio();
  return (
    <div className="flex min-h-screen">
      <StoreHydrator initialRequests={initialRequests} />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-gradient-to-b from-surface/70 to-white">
        <TopBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-8 py-8">
          <PersonaGate>{children}</PersonaGate>
        </main>
      </div>
    </div>
  );
}
