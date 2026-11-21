import type { ReactNode } from "react";
import { PersonaGate } from "./PersonaGate";
import { Sidebar } from "./Sidebar";
import { StoreHydrator } from "./StoreHydrator";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <StoreHydrator />
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
