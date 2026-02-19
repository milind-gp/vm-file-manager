"use client";

import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConnectionStore } from "@/stores/connection-store";
import { useExplorerStore } from "@/stores/explorer-store";
import { fsApi } from "@/lib/api-client";
import { Search, FileText, Folder, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"name" | "content">("name");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const activeTabId = useConnectionStore((s) => s.activeTabId);
  const { getExplorer, navigate } = useExplorerStore();

  const connectionId = activeTabId ?? "";
  const explorer = getExplorer(connectionId);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !connectionId) return;
    setLoading(true);
    try {
      const { results: searchResults } = await fsApi.search(
        connectionId, query, explorer.currentPath, searchType
      );
      setResults(searchResults);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, connectionId, explorer.currentPath, searchType]);

  const handleNavigate = (path: string) => {
    // Navigate to the parent directory of the result
    const parts = path.split("/");
    parts.pop();
    const dir = parts.join("/") || "/";
    navigate(connectionId, dir);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Search Files</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                autoFocus
              />
            </div>
            <Button
              variant={searchType === "name" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSearchType("name")}
            >
              Name
            </Button>
            <Button
              variant={searchType === "content" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSearchType("content")}
            >
              Content
            </Button>
          </div>

          <ScrollArea className="max-h-[400px]">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && results.length === 0 && query && (
              <p className="text-sm text-muted-foreground text-center py-8">No results found</p>
            )}
            {!loading &&
              results.map((path) => {
                const name = path.split("/").pop() ?? path;
                return (
                  <div
                    key={path}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded hover:bg-accent/50 text-sm"
                    onClick={() => handleNavigate(path)}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{name}</div>
                      <div className="truncate text-xs text-muted-foreground">{path}</div>
                    </div>
                  </div>
                );
              })}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
