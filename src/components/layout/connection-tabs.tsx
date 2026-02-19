"use client";

import { useConnectionStore } from "@/stores/connection-store";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { X, PanelLeftClose, PanelLeft, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { disconnectAndCleanup } from "@/lib/disconnect";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export function ConnectionTabs() {
  const { activeConnections, activeTabId, setActiveTab } = useConnectionStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const tabs = Array.from(activeConnections.entries());

  const handleDisconnect = async (connectionId: string) => {
    try {
      await disconnectAndCleanup(connectionId);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex h-10 items-center border-b border-border bg-muted/30 px-2">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 mr-2"
        onClick={toggleSidebar}
        title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
      </Button>

      <div className="flex flex-1 items-center gap-1 overflow-x-auto">
        {tabs.length === 0 && (
          <span className="text-sm text-muted-foreground px-2">No active connections</span>
        )}
        {tabs.map(([id, conn]) => (
          <div
            key={id}
            className={cn(
              "group flex items-center gap-1.5 rounded-md px-3 py-1 text-sm cursor-pointer transition-colors",
              activeTabId === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50"
            )}
            onClick={() => setActiveTab(id)}
          >
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                conn.status === "connected" && "bg-green-500",
                conn.status === "connecting" && "bg-yellow-500 animate-pulse",
                conn.status === "disconnected" && "bg-gray-400",
                conn.status === "error" && "bg-red-500"
              )}
            />
            <span className="max-w-32 truncate">{conn.connection.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                handleDisconnect(id);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 ml-2"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {mounted ? (
          resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
        ) : (
          <span className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
