import { createContext, useContext, useState, ReactNode } from "react";

type DrawerPage = "preview" | "published" | "console" | null;
type ToolsPanel = "tools" | null;

interface SidebarDrawerContextType {
  isOpen: boolean;
  currentPage: DrawerPage;
  position: "left" | "right";
  toolsOpen: boolean;
  openDrawer: (page: DrawerPage) => void;
  closeDrawer: () => void;
  togglePosition: () => void;
  openTools: () => void;
  closeTools: () => void;
}

const SidebarDrawerContext = createContext<SidebarDrawerContextType | undefined>(undefined);

export function SidebarDrawerProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<DrawerPage>(null);
  const [position, setPosition] = useState<"left" | "right">("right");
  const [toolsOpen, setToolsOpen] = useState(false);

  const openDrawer = (page: DrawerPage) => setCurrentPage(page);
  const closeDrawer = () => setCurrentPage(null);
  const togglePosition = () => setPosition(pos => pos === "left" ? "right" : "left");
  const openTools = () => setToolsOpen(true);
  const closeTools = () => setToolsOpen(false);

  return (
    <SidebarDrawerContext.Provider
      value={{
        isOpen: currentPage !== null,
        currentPage,
        position,
        toolsOpen,
        openDrawer,
        closeDrawer,
        togglePosition,
        openTools,
        closeTools,
      }}
    >
      {children}
    </SidebarDrawerContext.Provider>
  );
}

export function useSidebarDrawer() {
  const context = useContext(SidebarDrawerContext);
  if (!context) {
    throw new Error("useSidebarDrawer must be used within SidebarDrawerProvider");
  }
  return context;
}
