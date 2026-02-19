import type { Connection } from "./db/schema";
import type { FileEntry, FileStat } from "../../server/ssh/sftp-operations";
import type { SystemVitals } from "../../server/ssh/vitals";

const API_BASE = (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message = body.error || `Request failed: ${res.status}`;

    // If server says connection is gone, update frontend state to "disconnected"
    if (res.status === 400 && typeof message === "string" && message.includes("Connection not active")) {
      const connectionId = url.match(/\/fs\/([^/]+)/)?.[1];
      if (connectionId) {
        import("@/stores/connection-store").then(({ useConnectionStore }) => {
          const store = useConnectionStore.getState();
          const active = store.activeConnections.get(connectionId);
          if (active) {
            store.setConnectionStatus(connectionId, active.connection, "disconnected");
          }
        });
      }
    }

    throw new Error(message);
  }

  return res.json();
}

// Connection API
export const connectionsApi = {
  list: () => fetchJSON<Connection[]>("/connections"),

  get: (id: string) => fetchJSON<Connection>(`/connections/${id}`),

  create: (data: Omit<Connection, "id" | "createdAt" | "updatedAt">) =>
    fetchJSON<Connection>("/connections", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Connection>) =>
    fetchJSON<Connection>(`/connections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchJSON<{ success: boolean }>(`/connections/${id}`, { method: "DELETE" }),

  test: (id: string) =>
    fetchJSON<{ success: boolean; message: string }>(`/connections/${id}/test`, {
      method: "POST",
    }),

  connect: (id: string) =>
    fetchJSON<{ success: boolean }>(`/connections/${id}/connect`, {
      method: "POST",
    }),

  disconnect: (id: string) =>
    fetchJSON<{ success: boolean }>(`/connections/${id}/disconnect`, {
      method: "POST",
    }),

  status: (id: string) =>
    fetchJSON<{ status: "connected" | "disconnected" }>(`/connections/${id}/status`),
};

// Filesystem API
export const fsApi = {
  list: (connectionId: string, path: string) =>
    fetchJSON<{ path: string; entries: FileEntry[]; parent: string | null }>(
      `/fs/${connectionId}/list?path=${encodeURIComponent(path)}`
    ),

  stat: (connectionId: string, path: string) =>
    fetchJSON<FileStat>(`/fs/${connectionId}/stat?path=${encodeURIComponent(path)}`),

  read: (connectionId: string, path: string) =>
    fetchJSON<{ content: string; encoding: string }>(
      `/fs/${connectionId}/read?path=${encodeURIComponent(path)}`
    ),

  write: (connectionId: string, path: string, content: string) =>
    fetchJSON<{ success: boolean }>(`/fs/${connectionId}/write`, {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    }),

  mkdir: (connectionId: string, path: string) =>
    fetchJSON<{ success: boolean }>(`/fs/${connectionId}/mkdir`, {
      method: "POST",
      body: JSON.stringify({ path }),
    }),

  delete: (connectionId: string, path: string, recursive = false) =>
    fetchJSON<{ success: boolean }>(`/fs/${connectionId}/delete`, {
      method: "DELETE",
      body: JSON.stringify({ path, recursive }),
    }),

  rename: (connectionId: string, oldPath: string, newPath: string) =>
    fetchJSON<{ success: boolean }>(`/fs/${connectionId}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ oldPath, newPath }),
    }),

  copy: (connectionId: string, sourcePath: string, destinationPath: string) =>
    fetchJSON<{ success: boolean }>(`/fs/${connectionId}/copy`, {
      method: "POST",
      body: JSON.stringify({ sourcePath, destinationPath }),
    }),

  search: (connectionId: string, query: string, path = "/", type: "name" | "content" = "name") =>
    fetchJSON<{ results: string[] }>(
      `/fs/${connectionId}/search?query=${encodeURIComponent(query)}&path=${encodeURIComponent(path)}&type=${type}`
    ),

  vitals: (connectionId: string) =>
    fetchJSON<SystemVitals>(`/fs/${connectionId}/vitals`),

  getDownloadUrl: (connectionId: string, path: string) =>
    `${API_BASE}/fs/${connectionId}/download?path=${encodeURIComponent(path)}`,

  getPreviewUrl: (connectionId: string, path: string) =>
    `${API_BASE}/fs/${connectionId}/preview?path=${encodeURIComponent(path)}`,

  upload: async (connectionId: string, path: string, files: File[], relativePath?: string, onProgress?: (loaded: number, total: number) => void) => {
    const formData = new FormData();
    formData.append("path", path);
    if (relativePath) {
      formData.append("relativePath", relativePath);
    }
    for (const file of files) {
      formData.append("files", file);
    }

    return new Promise<{ success: boolean }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/fs/${connectionId}/upload`);

      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) onProgress(e.loaded, e.total);
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(JSON.parse(xhr.responseText).error || "Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    });
  },
};

// Bookmarks API
export const bookmarksApi = {
  list: () =>
    fetchJSON<Array<{ id: string; connectionId: string; path: string; label: string | null; sortOrder: number | null }>>("/bookmarks"),

  create: (data: { connectionId: string; path: string; label?: string }) =>
    fetchJSON<{ id: string }>("/bookmarks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchJSON<{ success: boolean }>(`/bookmarks/${id}`, { method: "DELETE" }),
};
