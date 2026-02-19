"use client";

import { create } from "zustand";
import type { Connection } from "@/lib/db/schema";

export type ConnectionStatus = "connected" | "disconnected" | "connecting" | "error";

export interface ActiveConnection {
  connection: Connection;
  status: ConnectionStatus;
  error?: string;
}

interface ConnectionStore {
  activeConnections: Map<string, ActiveConnection>;
  activeTabId: string | null;

  setActiveTab: (connectionId: string | null) => void;
  setConnectionStatus: (connectionId: string, connection: Connection, status: ConnectionStatus, error?: string) => void;
  removeConnection: (connectionId: string) => void;
  getActiveConnection: () => ActiveConnection | null;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  activeConnections: new Map(),
  activeTabId: null,

  setActiveTab: (connectionId) => set({ activeTabId: connectionId }),

  setConnectionStatus: (connectionId, connection, status, error) =>
    set((state) => {
      const newMap = new Map(state.activeConnections);
      newMap.set(connectionId, { connection, status, error });
      return {
        activeConnections: newMap,
        activeTabId: state.activeTabId || connectionId,
      };
    }),

  removeConnection: (connectionId) =>
    set((state) => {
      const newMap = new Map(state.activeConnections);
      newMap.delete(connectionId);
      const nextTab = state.activeTabId === connectionId
        ? (newMap.keys().next().value ?? null)
        : state.activeTabId;
      return { activeConnections: newMap, activeTabId: nextTab };
    }),

  getActiveConnection: () => {
    const { activeConnections, activeTabId } = get();
    if (!activeTabId) return null;
    return activeConnections.get(activeTabId) ?? null;
  },
}));
