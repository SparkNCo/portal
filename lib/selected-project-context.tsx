"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

// Which assigned project a developer is currently working on (picked from
// the sidebar dropdown, see components/sidebar.tsx). Kept out of the URL —
// a query param would leak the customer's name into browser history, logs,
// and any shared/copied link — and persisted to localStorage instead, so it
// survives a reload without needing the URL for it.
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
