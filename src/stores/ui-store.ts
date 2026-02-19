"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  sidebarOpen: boolean;
  sidebarWidth: number;
  terminalOpen: boolean;
  terminalHeight: number;
  theme: "light" | "dark" | "system";
  connectionFormOpen: boolean;
  editingConnectionId: string | null;
  sshImportOpen: boolean;

  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  toggleTerminal: () => void;
  setTerminalHeight: (height: number) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  openConnectionForm: (editId?: string) => void;
  closeConnectionForm: () => void;
  openSSHImport: () => void;
  closeSSHImport: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      sidebarWidth: 280,
      terminalOpen: false,
      terminalHeight: 300,
      theme: "dark",
      connectionFormOpen: false,
      editingConnectionId: null,
      sshImportOpen: false,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
      setTerminalHeight: (height) => set({ terminalHeight: height }),
      setTheme: (theme) => set({ theme }),
      openConnectionForm: (editId) => set({ connectionFormOpen: true, editingConnectionId: editId ?? null }),
      closeConnectionForm: () => set({ connectionFormOpen: false, editingConnectionId: null }),
      openSSHImport: () => set({ sshImportOpen: true }),
      closeSSHImport: () => set({ sshImportOpen: false }),
    }),
    {
      name: "file-manager-ui",
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        terminalOpen: state.terminalOpen,
        terminalHeight: state.terminalHeight,
        theme: state.theme,
        // Intentionally exclude connectionFormOpen and editingConnectionId from persistence
      }),
    }
  )
);
