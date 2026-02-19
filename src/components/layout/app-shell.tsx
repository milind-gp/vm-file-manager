"use client";

import { useUIStore } from "@/stores/ui-store";
import { Sidebar } from "./sidebar";
import { ConnectionTabs } from "./connection-tabs";
import { StatusBar } from "./status-bar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <ConnectionTabs />
      <div className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            "border-r border-border transition-all duration-200",
            sidebarOpen ? "block" : "hidden"
          )}
          style={{ width: sidebarOpen ? sidebarWidth : 0 }}
        >
          <Sidebar />
        </div>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      <StatusBar />
    </div>
  );
}
