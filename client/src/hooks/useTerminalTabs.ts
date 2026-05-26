
import { useState } from "react";

export interface TerminalTab {
  id: string;
  title: string;
}

export function useTerminalTabs() {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const addTab = () => {
    const id = crypto.randomUUID();
    setTabs((t) => [...t, { id, title: "Terminal" }]);
    setActiveId(id);
  };

  const closeTab = (id: string) => {
    setTabs((t) => t.filter((x) => x.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return { tabs, activeId, addTab, closeTab, setActiveId };
}
