"use client";

import { useUIStore } from "@/stores/ui-store";
import { useConnectionStore } from "@/stores/connection-store";
import { useTerminalStore } from "@/stores/terminal-store";
import { Button } from "@/components/ui/button";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TerminalInstance } from "./terminal-instance";

export function TerminalPanel() {
  const { terminalOpen, toggleTerminal, terminalHeight, setTerminalHeight } = useUIStore();
  const activeTabId = useConnectionStore((s) => s.activeTabId);
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const { addSession, removeSession, setActiveSession, getSessions, getActiveSession } =
    useTerminalStore();

  const connectionId = activeTabId ?? "";
  const active = activeTabId ? activeConnections.get(activeTabId) : null;
  const isConnected = active?.status === "connected";

  const sessions = getSessions(connectionId);
  const activeSessionId = getActiveSession(connectionId);

  if (!terminalOpen || !isConnected) return null;

  const handleNewSession = () => {
    addSession(connectionId);
  };

  return (
    <div
      className="border-t border-border bg-background flex flex-col"
      style={{ height: terminalHeight }}
    >
      {/* Terminal tab bar */}
      <div className="flex items-center border-b border-border bg-muted/30 px-2 py-0.5">
        <span className="text-xs font-medium text-muted-foreground mr-2">Terminal</span>
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "group flex items-center gap-1 px-2 py-0.5 rounded text-xs cursor-pointer",
                activeSessionId === session.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:bg-background/50"
              )}
              onClick={() => setActiveSession(connectionId, session.id)}
            >
              <span>{session.id}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSession(connectionId, session.id);
                }}
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNewSession}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggleTerminal}>
          {terminalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn("h-full", activeSessionId === session.id ? "block" : "hidden")}
          >
            <TerminalInstance connectionId={connectionId} sessionId={session.id} />
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            <Button variant="outline" size="sm" onClick={handleNewSession}>
              <Plus className="h-4 w-4 mr-1" />
              New Terminal
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
