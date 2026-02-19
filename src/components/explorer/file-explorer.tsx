"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnectionStore } from "@/stores/connection-store";
import { useExplorerStore } from "@/stores/explorer-store";
import { fsApi, bookmarksApi } from "@/lib/api-client";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { Toolbar } from "./toolbar";
import { FileGrid } from "./file-grid";
import { UploadZone } from "@/components/upload/upload-zone";
import { toast } from "sonner";
import { Loader2, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/ui-store";
import { useMemo, useRef } from "react";
import type { FileEntry } from "../../../server/ssh/sftp-operations";

export function FileExplorer() {
  const activeTabId = useConnectionStore((s) => s.activeTabId);
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const { getExplorer, navigate, setSort, setViewMode, toggleHidden } = useExplorerStore();
  const queryClient = useQueryClient();

  const connectionId = activeTabId ?? "";
  const active = activeTabId ? activeConnections.get(activeTabId) : null;
  const explorer = getExplorer(connectionId);
  const uploadOpenRef = useRef<(() => void) | null>(null);
  const uploadFolderRef = useRef<(() => void) | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["fs", "list", connectionId, explorer.currentPath],
    queryFn: () => fsApi.list(connectionId, explorer.currentPath),
    enabled: !!connectionId && active?.status === "connected",
    refetchOnWindowFocus: false,
  });

  const entries = useMemo(() => {
    let e: FileEntry[] = data?.entries ?? [];
    if (!explorer.showHidden) {
      e = e.filter((entry) => !entry.isHidden);
    }
    return sortEntries(e, explorer.sortBy, explorer.sortDir);
  }, [data?.entries, explorer.showHidden, explorer.sortBy, explorer.sortDir]);

  const openConnectionForm = useUIStore((s) => s.openConnectionForm);

  if (!connectionId || !active || active.status !== "connected") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <FolderOpen className="h-16 w-16 opacity-20" strokeWidth={1} />
        <div className="text-center space-y-1">
          <p className="text-lg font-medium text-foreground/70">Your workspace is ready</p>
          <p className="text-sm">Select a connection from the sidebar to get started</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => openConnectionForm()}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Connection
        </Button>
      </div>
    );
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["fs", "list", connectionId, explorer.currentPath] });
  };

  const handleBookmark = async () => {
    try {
      await bookmarksApi.create({
        connectionId,
        path: explorer.currentPath,
        label: explorer.currentPath.split("/").pop() || explorer.currentPath,
      });
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success("Bookmarked!");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <BreadcrumbNav
        connectionId={connectionId}
        path={explorer.currentPath}
        onNavigate={(path) => navigate(connectionId, path)}
      />
      <Toolbar
        viewMode={explorer.viewMode}
        sortBy={explorer.sortBy}
        sortDir={explorer.sortDir}
        showHidden={explorer.showHidden}
        onViewModeChange={(mode) => setViewMode(connectionId, mode)}
        onSortChange={(by) => setSort(connectionId, by)}
        onToggleHidden={() => toggleHidden(connectionId)}
        onRefresh={handleRefresh}
        onBookmark={handleBookmark}
        onUpload={() => uploadOpenRef.current?.()}
        onUploadFolder={() => uploadFolderRef.current?.()}
      />
      <UploadZone connectionId={connectionId} remotePath={explorer.currentPath} onUploaded={handleRefresh} openRef={uploadOpenRef} openFolderRef={uploadFolderRef}>
        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="flex h-full items-center justify-center text-destructive">
              <p>{(error as Error).message}</p>
            </div>
          )}
          {!isLoading && !error && (
            <FileGrid
              connectionId={connectionId}
              entries={entries}
              viewMode={explorer.viewMode}
              selectedItems={explorer.selectedItems}
              onRefresh={handleRefresh}
            />
          )}
        </div>
      </UploadZone>
    </div>
  );
}

function sortEntries(entries: FileEntry[], sortBy: string, sortDir: string): FileEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Directories always first
    if (a.type === "directory" && b.type !== "directory") return -1;
    if (a.type !== "directory" && b.type === "directory") return 1;

    let cmp = 0;
    switch (sortBy) {
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        break;
      case "size":
        cmp = a.size - b.size;
        break;
      case "modified":
        cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
        break;
      case "type": {
        const extA = a.name.split(".").pop() ?? "";
        const extB = b.name.split(".").pop() ?? "";
        cmp = extA.localeCompare(extB);
        break;
      }
    }
    return cmp;
  });

  return sortDir === "desc" ? sorted.reverse() : sorted;
}
