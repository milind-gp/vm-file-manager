"use client";

import { AppShell } from "@/components/layout/app-shell";
import { FileExplorer } from "@/components/explorer/file-explorer";
import { CodeEditor } from "@/components/editor/code-editor";
import { TerminalPanel } from "@/components/terminal/terminal-panel";
import { SearchDialog } from "@/components/search/search-dialog";
import { useConnectionStore } from "@/stores/connection-store";
import { useUIStore } from "@/stores/ui-store";
import { useEditorStore } from "@/stores/editor-store";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Terminal, Search } from "lucide-react";

export default function HomePage() {
  const activeTabId = useConnectionStore((s) => s.activeTabId);
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const { toggleTerminal, terminalOpen } = useUIStore();
  const editorTabs = useEditorStore((s) => s.tabs);
  const [searchOpen, setSearchOpen] = useState(false);

  const active = activeTabId ? activeConnections.get(activeTabId) : null;
  const isConnected = active?.status === "connected";
  const hasEditorTabs = editorTabs.some((t) => t.connectionId === activeTabId);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "`") {
        e.preventDefault();
        toggleTerminal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleTerminal]);

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        <div className="flex flex-1 overflow-hidden">
          <div className={hasEditorTabs ? "w-1/2 border-r border-border" : "w-full"}>
            <FileExplorer />
          </div>
          {hasEditorTabs && (
            <div className="w-1/2">
              <CodeEditor />
            </div>
          )}
        </div>

        <TerminalPanel />

        {isConnected && (
          <div className="absolute bottom-8 right-4 flex gap-2 z-30">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full shadow-lg bg-background"
              onClick={() => setSearchOpen(true)}
              title="Search (Cmd+K)"
            >
              <Search className="h-5 w-5" />
            </Button>
            {!terminalOpen && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg bg-background"
                onClick={toggleTerminal}
                title="Terminal (Cmd+`)"
              >
                <Terminal className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}

        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </AppShell>
  );
}
