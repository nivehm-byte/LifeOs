import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
