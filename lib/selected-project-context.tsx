"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

// The project a developer last picked in the sidebar's "Working on"
// dropdown (see components/sidebar.tsx), persisted to localStorage. The URL
// (/{slug}/…) decides which initiative a page shows; this only fills in
// where there's no slug to go on — /dev/chat, the login redirect, and old
// /dev/* links (see lib/developer-routes.ts).
const STORAGE_KEY = "dev-selected-project";

interface SelectedProjectContextValue {
  selectedProject: string | null;
  setSelectedProject: (clientName: string) => void;
}

const SelectedProjectContext = createContext<SelectedProjectContextValue>({
  selectedProject: null,
  setSelectedProject: () => {},
});

export function SelectedProjectProvider({ children }: { children: ReactNode }) {
  const [selectedProject, setSelectedProjectState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedProjectState(stored);
    } catch {
      // localStorage can throw (private browsing, disabled storage) — fall
      // back to no persisted selection rather than breaking the page.
    }
  }, []);

  const setSelectedProject = (clientName: string) => {
    setSelectedProjectState(clientName);
    try {
      localStorage.setItem(STORAGE_KEY, clientName);
    } catch {
      // Best-effort persistence only.
    }
  };

  return (
    <SelectedProjectContext.Provider value={{ selectedProject, setSelectedProject }}>
      {children}
    </SelectedProjectContext.Provider>
  );
}

export const useSelectedProject = () => useContext(SelectedProjectContext);
