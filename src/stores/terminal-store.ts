"use client";

import { create } from "zustand";

export interface TerminalSession {
  id: string;
  connectionId: string;
  isOpen: boolean;
}

interface TerminalStore {
  sessions: Map<string, TerminalSession[]>;
  activeSessionId: Map<string, string>;

  addSession: (connectionId: string) => string;
  removeSession: (connectionId: string, sessionId: string) => void;
  setActiveSession: (connectionId: string, sessionId: string) => void;
  getSessions: (connectionId: string) => TerminalSession[];
  getActiveSession: (connectionId: string) => string | null;
  clearForConnection: (connectionId: string) => void;
}

export const useTerminalStore = create<TerminalStore>((set, get) => ({
  sessions: new Map(),
  activeSessionId: new Map(),

  addSession: (connectionId) => {
    const id = `term-${crypto.randomUUID()}`;
    set((state) => {
      const sessions = new Map(state.sessions);
      const activeSessionId = new Map(state.activeSessionId);
      const existing = sessions.get(connectionId) ?? [];
      sessions.set(connectionId, [...existing, { id, connectionId, isOpen: true }]);
      activeSessionId.set(connectionId, id);
      return { sessions, activeSessionId };
    });
    return id;
  },

  removeSession: (connectionId, sessionId) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      const activeSessionId = new Map(state.activeSessionId);
      const existing = sessions.get(connectionId) ?? [];
      const filtered = existing.filter((s) => s.id !== sessionId);
      sessions.set(connectionId, filtered);
      if (activeSessionId.get(connectionId) === sessionId) {
        activeSessionId.set(connectionId, filtered[filtered.length - 1]?.id ?? "");
      }
      return { sessions, activeSessionId };
    }),

  setActiveSession: (connectionId, sessionId) =>
    set((state) => {
      const activeSessionId = new Map(state.activeSessionId);
      activeSessionId.set(connectionId, sessionId);
      return { activeSessionId };
    }),

  getSessions: (connectionId) => get().sessions.get(connectionId) ?? [],

  getActiveSession: (connectionId) => get().activeSessionId.get(connectionId) ?? null,

  clearForConnection: (connectionId) =>
    set((state) => {
      const sessions = new Map(state.sessions);
      const activeSessionId = new Map(state.activeSessionId);
      sessions.delete(connectionId);
      activeSessionId.delete(connectionId);
      return { sessions, activeSessionId };
    }),
}));
