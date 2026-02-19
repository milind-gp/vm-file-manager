"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { connectionsApi, bookmarksApi } from "@/lib/api-client";
import { useConnectionStore } from "@/stores/connection-store";
import { useExplorerStore } from "@/stores/explorer-store";
import { useUIStore } from "@/stores/ui-store";
import { disconnectAndCleanup } from "@/lib/disconnect";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Server, Plus, Bookmark, History, Wifi, WifiOff, Trash2, Pencil,
  MoreHorizontal, Unplug, Download, Folder,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export function Sidebar() {
  const { activeConnections, activeTabId, setActiveTab, setConnectionStatus } = useConnectionStore();
  const { navigate, getExplorer } = useExplorerStore();
  const openConnectionForm = useUIStore((s) => s.openConnectionForm);
  const openSSHImport = useUIStore((s) => s.openSSHImport);
  const queryClient = useQueryClient();

  const { data: connections = [] } = useQuery({
    queryKey: ["connections"],
    queryFn: connectionsApi.list,
  });

  const { data: bookmarks = [], refetch: refetchBookmarks } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: bookmarksApi.list,
  });

  const handleConnect = async (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) return;

    setConnectionStatus(connectionId, connection, "connecting");
    try {
      await connectionsApi.connect(connectionId);
      setConnectionStatus(connectionId, connection, "connected");
      navigate(connectionId, connection.defaultPath || "/");
      setActiveTab(connectionId);
      toast.success(`Connected to ${connection.name}`);
    } catch (err) {
      setConnectionStatus(connectionId, connection, "error", (err as Error).message);
      toast.error(`Failed to connect: ${(err as Error).message}`);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    try {
      // Disconnect and clean up all stores first
      if (activeConnections.has(connectionId)) {
        await disconnectAndCleanup(connectionId);
      }
      await connectionsApi.delete(connectionId);
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      toast.success("Connection deleted");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await disconnectAndCleanup(connectionId);
      toast.success("Disconnected");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    try {
      await bookmarksApi.delete(id);
      refetchBookmarks();
      toast.success("Bookmark removed");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleNavigateBookmark = (connectionId: string, path: string) => {
    if (activeConnections.has(connectionId)) {
      setActiveTab(connectionId);
      navigate(connectionId, path);
    } else {
      toast.error("Connection is not active. Connect first.");
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Connections Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Connections
            </h3>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={openSSHImport}
                title="Import from SSH config"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => openConnectionForm()}
                title="New connection"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            {connections.map((conn) => {
              const active = activeConnections.get(conn.id);
              const isConnected = active?.status === "connected";
              return (
                <div
                  key={conn.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer transition-colors",
                    activeTabId === conn.id
                      ? "bg-accent text-accent-foreground border-l-2 border-l-primary"
                      : "hover:bg-accent/50 border-l-2 border-l-transparent"
                  )}
                  onClick={() => isConnected ? setActiveTab(conn.id) : handleConnect(conn.id)}
                >
                  <Server className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{conn.name}</span>
                  <div className="flex items-center gap-1">
                    {isConnected ? (
                      <Wifi className="h-3.5 w-3.5 text-green-500" />
                    ) : active?.status === "connecting" ? (
                      <Wifi className="h-3.5 w-3.5 text-yellow-500 animate-pulse" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openConnectionForm(conn.id)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {isConnected && (
                          <DropdownMenuItem onClick={() => handleDisconnect(conn.id)}>
                            <Unplug className="h-3.5 w-3.5 mr-2" />
                            Disconnect
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteConnection(conn.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
            {connections.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                No connections yet. Click + to add one.
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Bookmarks Section */}
        <div>
          <div className="flex items-center mb-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
              Bookmarks
            </h3>
          </div>
          <div className="space-y-1">
            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-accent/50"
                onClick={() => handleNavigateBookmark(bm.connectionId, bm.path)}
              >
                <Bookmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{bm.label || bm.path}</div>
                  {bm.label && (
                    <div className="text-xs text-muted-foreground truncate">{bm.path}</div>
                  )}
                  <div className="text-xs text-muted-foreground/60 truncate">
                    {connections.find((c) => c.id === bm.connectionId)?.name ?? "Unknown"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBookmark(bm.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {bookmarks.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-2 text-center">
                No bookmarks yet
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Recent Paths */}
        {activeTabId && activeConnections.get(activeTabId)?.status === "connected" && (
          <RecentPaths
            connectionId={activeTabId}
            getExplorer={getExplorer}
            onNavigate={(path) => navigate(activeTabId, path)}
          />
        )}
      </div>
    </ScrollArea>
  );
}

function RecentPaths({
  connectionId,
  getExplorer,
  onNavigate,
}: {
  connectionId: string;
  getExplorer: (id: string) => { currentPath: string; history: string[] };
  onNavigate: (path: string) => void;
}) {
  const explorer = getExplorer(connectionId);

  const recentPaths = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    // Walk history backwards, skip current path, deduplicate
    for (let i = explorer.history.length - 1; i >= 0; i--) {
      const p = explorer.history[i];
      if (p === explorer.currentPath || seen.has(p)) continue;
      seen.add(p);
      result.push(p);
      if (result.length >= 8) break;
    }
    return result;
  }, [explorer.history, explorer.currentPath]);

  return (
    <div>
      <div className="flex items-center mb-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          <History className="h-3 w-3 inline mr-1" />
          Recent
        </h3>
      </div>
      <div className="space-y-1">
        {recentPaths.map((p) => (
          <div
            key={p}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent/50"
            onClick={() => onNavigate(p)}
          >
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="truncate">{p.split("/").pop() || "/"}</div>
              <div className="text-xs text-muted-foreground truncate">{p}</div>
            </div>
          </div>
        ))}
        {recentPaths.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-2 text-center">
            No recent paths
          </p>
        )}
      </div>
    </div>
  );
}
