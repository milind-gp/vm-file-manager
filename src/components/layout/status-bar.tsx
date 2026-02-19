"use client";

import { useConnectionStore } from "@/stores/connection-store";
import { useExplorerStore } from "@/stores/explorer-store";
import { useUploadStore } from "@/stores/upload-store";
import { fsApi } from "@/lib/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { VitalsIndicator, VitalsPopover } from "./vitals-popover";

export function StatusBar() {
  const activeTabId = useConnectionStore((s) => s.activeTabId);
  const activeConnections = useConnectionStore((s) => s.activeConnections);
  const getExplorer = useExplorerStore((s) => s.getExplorer);
  const uploads = useUploadStore((s) => s.uploads);
  const queryClient = useQueryClient();

  const active = activeTabId ? activeConnections.get(activeTabId) : null;
  const explorer = activeTabId ? getExplorer(activeTabId) : null;
  const activeUploads = uploads.filter((u) => u.status === "uploading");

  const { data: vitals, isLoading: vitalsLoading } = useQuery({
    queryKey: ["vitals", activeTabId],
    queryFn: () => fsApi.vitals(activeTabId!),
    enabled: !!activeTabId && active?.status === "connected",
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleRefreshVitals = () => {
    if (activeTabId) {
      queryClient.invalidateQueries({ queryKey: ["vitals", activeTabId] });
    }
  };

  return (
    <div className="flex h-6 items-center border-t border-border bg-muted/30 px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-4 flex-1">
        {active && (
          <>
            <span>
              {active.connection.username}@{active.connection.host}:{active.connection.port}
            </span>
            {explorer && <span>{explorer.currentPath}</span>}
            {explorer && explorer.selectedItems.size > 0 && (
              <span>{explorer.selectedItems.size} selected</span>
            )}
          </>
        )}
        {!active && <span>No active connection</span>}
      </div>
      <div className="flex items-center gap-4">
        {activeUploads.length > 0 && (
          <span>{activeUploads.length} upload(s) in progress</span>
        )}
        {activeTabId && active?.status === "connected" && (
          <VitalsPopover
            vitals={vitals}
            isLoading={vitalsLoading}
            onRefresh={handleRefreshVitals}
          >
            <button className="flex items-center cursor-pointer hover:text-foreground transition-colors">
              <VitalsIndicator vitals={vitals} isLoading={vitalsLoading} />
            </button>
          </VitalsPopover>
        )}
      </div>
    </div>
  );
}
