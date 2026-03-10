"use client";

import { createContext, useContext, useState, useCallback } from "react";

type SidePanelContextType = {
  panel: React.ReactNode | null;
  setPanel: (panel: React.ReactNode | null) => void;
};

const SidePanelContext = createContext<SidePanelContextType>({
  panel: null,
  setPanel: () => {},
});

export function SidePanelProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanel] = useState<React.ReactNode | null>(null);

  const setPanelStable = useCallback(
    (p: React.ReactNode | null) => setPanel(p),
    []
  );

  return (
    <SidePanelContext.Provider value={{ panel, setPanel: setPanelStable }}>
      {children}
    </SidePanelContext.Provider>
  );
}

export function useSidePanel() {
  return useContext(SidePanelContext);
}
