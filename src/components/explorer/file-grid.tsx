"use client";

import { useExplorerStore } from "@/stores/explorer-store";
import { useEditorStore } from "@/stores/editor-store";
import { fsApi } from "@/lib/api-client";
import { getFileIcon, getFileIconColor } from "@/lib/file-icons";
import { getLanguageFromExtension, getFileCategory } from "@/lib/constants";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useState, useRef, useCallback } from "react";
import {
  Edit3, Trash2, Copy, Scissors, Clipboard, Download,
  FolderOpen, FileText, Eye,
} from "lucide-react";
import { RenameDialog } from "./rename-dialog";
import { DeleteDialog } from "./delete-dialog";
import type { FileEntry } from "../../../server/ssh/sftp-operations";
import type { ViewMode } from "@/stores/explorer-store";

interface FileGridProps {
  connectionId: string;
  entries: FileEntry[];
  viewMode: ViewMode;
  selectedItems: Set<string>;
  onRefresh: () => void;
}

export function FileGrid({ connectionId, entries, viewMode, selectedItems, onRefresh }: FileGridProps) {
  const { navigate, selectItem, setClipboard, getExplorer } = useExplorerStore();
  const { openFile } = useEditorStore();
  const [renaming, setRenaming] = useState<FileEntry | null>(null);
  const [deleting, setDeleting] = useState<FileEntry | null>(null);
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);

  const explorer = getExplorer(connectionId);

  const handleDoubleClick = async (entry: FileEntry) => {
    if (entry.type === "directory") {
      navigate(connectionId, entry.path);
    } else {
      const category = getFileCategory(entry.name);
      if (category === "text" || category === "markdown") {
        try {
          const { content } = await fsApi.read(connectionId, entry.path);
          const language = getLanguageFromExtension(entry.name);
          openFile(connectionId, entry.path, content, language);
        } catch (err) {
          toast.error((err as Error).message);
        }
      } else {
        setPreviewEntry(entry);
      }
    }
  };

  const handleClick = (entry: FileEntry, e: React.MouseEvent) => {
    selectItem(connectionId, entry.path, e.metaKey || e.ctrlKey);
  };

  const handleCopy = (entries: FileEntry[]) => {
    setClipboard(connectionId, entries, "copy");
    toast.success(`${entries.length} item(s) copied`);
  };

  const handleCut = (entries: FileEntry[]) => {
    setClipboard(connectionId, entries, "cut");
    toast.success(`${entries.length} item(s) cut`);
  };

  const handlePaste = async () => {
    if (!explorer.clipboard) return;
    try {
      for (const entry of explorer.clipboard.entries) {
        const destPath = `${explorer.currentPath}/${entry.name}`;
        if (explorer.clipboard.operation === "copy") {
          await fsApi.copy(connectionId, entry.path, destPath);
        } else {
          await fsApi.rename(connectionId, entry.path, destPath);
        }
      }
      onRefresh();
      toast.success("Paste complete");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleDownload = (entry: FileEntry) => {
    const url = fsApi.getDownloadUrl(connectionId, entry.path);
    const a = document.createElement("a");
    a.href = url;
    a.download = entry.name;
    a.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const parentRef = useRef<HTMLDivElement>(null);

  // Grid view: compute columns from container width
  const GRID_ITEM_MIN_WIDTH = 120;
  const GRID_ITEM_HEIGHT = 100;
  const GRID_GAP = 8;
  const GRID_PADDING = 12;
  const LIST_ROW_HEIGHT = 36;

  const [containerWidth, setContainerWidth] = useState(0);
  const gridColumns = Math.max(1, Math.floor((containerWidth - GRID_PADDING * 2 + GRID_GAP) / (GRID_ITEM_MIN_WIDTH + GRID_GAP)));
  const gridRowCount = Math.ceil(entries.length / gridColumns);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    // Assign to parentRef for virtualizer
    (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    const ro = new ResizeObserver((resizeEntries) => {
      for (const re of resizeEntries) {
        setContainerWidth(re.contentRect.width);
      }
    });
    ro.observe(node);
    setContainerWidth(node.getBoundingClientRect().width);
    // cleanup not strictly needed since component unmounts, but ResizeObserver is lightweight
  }, []);

  const listVirtualizer = useVirtualizer({
    count: viewMode === "list" ? entries.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => LIST_ROW_HEIGHT,
    overscan: 15,
  });

  const gridVirtualizer = useVirtualizer({
    count: viewMode === "grid" ? gridRowCount : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => GRID_ITEM_HEIGHT + GRID_GAP,
    overscan: 5,
  });

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground p-8">
        <p>This folder is empty</p>
      </div>
    );
  }

  if (viewMode === "grid") {
    const virtualRows = gridVirtualizer.getVirtualItems();

    return (
      <>
        <div ref={measureRef} className="h-full overflow-auto">
          <div
            className="relative"
            style={{
              height: gridVirtualizer.getTotalSize(),
              padding: GRID_PADDING,
            }}
          >
            {virtualRows.map((virtualRow) => {
              const startIndex = virtualRow.index * gridColumns;
              const rowEntries = entries.slice(startIndex, startIndex + gridColumns);

              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 right-0 flex"
                  style={{
                    top: virtualRow.start,
                    height: virtualRow.size,
                    padding: `0 ${GRID_PADDING}px`,
                    gap: GRID_GAP,
                  }}
                >
                  {rowEntries.map((entry) => {
                    const Icon = getFileIcon(entry.name, entry.type === "directory");
                    const iconColor = getFileIconColor(entry.name, entry.type === "directory");
                    const isSelected = selectedItems.has(entry.path);

                    return (
                      <ContextMenu key={entry.path}>
                        <ContextMenuTrigger asChild>
                          <div
                            className={cn(
                              "flex flex-col items-center gap-1 rounded-lg p-3 cursor-pointer transition-colors text-center",
                              isSelected ? "bg-accent" : "hover:bg-accent/50"
                            )}
                            style={{ width: GRID_ITEM_MIN_WIDTH, minWidth: GRID_ITEM_MIN_WIDTH }}
                            onClick={(e) => handleClick(entry, e)}
                            onDoubleClick={() => handleDoubleClick(entry)}
                          >
                            <Icon className={cn("h-10 w-10", iconColor)} />
                            <span className="text-xs truncate w-full">{entry.name}</span>
                          </div>
                        </ContextMenuTrigger>
                        <FileContextMenu
                          entry={entry}
                          onOpen={() => handleDoubleClick(entry)}
                          onRename={() => setRenaming(entry)}
                          onDelete={() => setDeleting(entry)}
                          onCopy={() => handleCopy([entry])}
                          onCut={() => handleCut([entry])}
                          onPaste={handlePaste}
                          onDownload={() => handleDownload(entry)}
                          hasClipboard={!!explorer.clipboard}
                        />
                      </ContextMenu>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {renaming && <RenameDialog entry={renaming} connectionId={connectionId} onClose={() => { setRenaming(null); onRefresh(); }} />}
        {deleting && <DeleteDialog entry={deleting} connectionId={connectionId} onClose={() => { setDeleting(null); onRefresh(); }} />}
        {previewEntry && (
          <PreviewOverlay entry={previewEntry} connectionId={connectionId} onClose={() => setPreviewEntry(null)} />
        )}
      </>
    );
  }

  // List view (virtualized)
  const virtualItems = listVirtualizer.getVirtualItems();

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-[1fr_100px_180px_100px] gap-2 px-3 py-1 text-xs font-medium text-muted-foreground border-b border-border shrink-0">
          <span>Name</span>
          <span className="text-right">Size</span>
          <span>Modified</span>
          <span>Permissions</span>
        </div>
        <div ref={viewMode === "list" ? measureRef : undefined} className="flex-1 overflow-auto">
          <div className="relative" style={{ height: listVirtualizer.getTotalSize() }}>
            {virtualItems.map((virtualRow) => {
              const entry = entries[virtualRow.index];
              const Icon = getFileIcon(entry.name, entry.type === "directory");
              const iconColor = getFileIconColor(entry.name, entry.type === "directory");
              const isSelected = selectedItems.has(entry.path);

              return (
                <ContextMenu key={virtualRow.key}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn(
                        "absolute left-0 right-0 grid grid-cols-[1fr_100px_180px_100px] gap-2 items-center px-3 cursor-pointer transition-colors text-sm",
                        isSelected ? "bg-accent" : "hover:bg-accent/50"
                      )}
                      style={{
                        top: virtualRow.start,
                        height: virtualRow.size,
                      }}
                      onClick={(e) => handleClick(entry, e)}
                      onDoubleClick={() => handleDoubleClick(entry)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
                        <span className="truncate">{entry.name}</span>
                      </div>
                      <span className="text-right text-muted-foreground">
                        {entry.type === "directory" ? "—" : formatSize(entry.size)}
                      </span>
                      <span className="text-muted-foreground text-xs">{formatDate(entry.modified)}</span>
                      <span className="text-muted-foreground font-mono text-xs">{entry.permissions}</span>
                    </div>
                  </ContextMenuTrigger>
                  <FileContextMenu
                    entry={entry}
                    onOpen={() => handleDoubleClick(entry)}
                    onRename={() => setRenaming(entry)}
                    onDelete={() => setDeleting(entry)}
                    onCopy={() => handleCopy([entry])}
                    onCut={() => handleCut([entry])}
                    onPaste={handlePaste}
                    onDownload={() => handleDownload(entry)}
                    hasClipboard={!!explorer.clipboard}
                  />
                </ContextMenu>
              );
            })}
          </div>
        </div>
      </div>
      {renaming && <RenameDialog entry={renaming} connectionId={connectionId} onClose={() => { setRenaming(null); onRefresh(); }} />}
      {deleting && <DeleteDialog entry={deleting} connectionId={connectionId} onClose={() => { setDeleting(null); onRefresh(); }} />}
      {previewEntry && (
        <PreviewOverlay entry={previewEntry} connectionId={connectionId} onClose={() => setPreviewEntry(null)} />
      )}
    </>
  );
}

function FileContextMenu({
  entry, onOpen, onRename, onDelete, onCopy, onCut, onPaste, onDownload, hasClipboard,
}: {
  entry: FileEntry;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDownload: () => void;
  hasClipboard: boolean;
}) {
  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={onOpen}>
        {entry.type === "directory" ? (
          <><FolderOpen className="h-4 w-4 mr-2" />Open</>
        ) : (
          <><FileText className="h-4 w-4 mr-2" />Open</>
        )}
      </ContextMenuItem>
      {entry.type === "file" && (
        <ContextMenuItem onClick={onOpen}>
          <Eye className="h-4 w-4 mr-2" />Preview
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onCopy}>
        <Copy className="h-4 w-4 mr-2" />Copy
      </ContextMenuItem>
      <ContextMenuItem onClick={onCut}>
        <Scissors className="h-4 w-4 mr-2" />Cut
      </ContextMenuItem>
      {hasClipboard && (
        <ContextMenuItem onClick={onPaste}>
          <Clipboard className="h-4 w-4 mr-2" />Paste
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onRename}>
        <Edit3 className="h-4 w-4 mr-2" />Rename
      </ContextMenuItem>
      {entry.type === "file" && (
        <ContextMenuItem onClick={onDownload}>
          <Download className="h-4 w-4 mr-2" />Download
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onDelete} className="text-destructive">
        <Trash2 className="h-4 w-4 mr-2" />Delete
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function PreviewOverlay({ entry, connectionId, onClose }: { entry: FileEntry; connectionId: string; onClose: () => void }) {
  const category = getFileCategory(entry.name);
  const previewUrl = fsApi.getPreviewUrl(connectionId, entry.path);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div className="max-w-[90vw] max-h-[90vh] bg-background rounded-lg p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">{entry.name}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="overflow-auto max-h-[80vh]">
          {category === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={entry.name} className="max-w-full max-h-[75vh] object-contain" />
          )}
          {(category === "video") && (
            <video src={previewUrl} controls className="max-w-full max-h-[75vh]" />
          )}
          {category === "audio" && (
            <audio src={previewUrl} controls className="w-full" />
          )}
          {category === "pdf" && (
            <iframe src={previewUrl} className="w-[80vw] h-[75vh]" />
          )}
          {(category === "unknown") && (
            <p className="text-muted-foreground p-4">Preview not available for this file type</p>
          )}
        </div>
      </div>
    </div>
  );
}
