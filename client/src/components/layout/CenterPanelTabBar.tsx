import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceTab } from "./editor-toolbar";

interface CenterPanelTabBarProps {
  tabs: WorkspaceTab[];
  activeTabId: number;
  dirtyTabIds: Set<number>;
  onSwitchTab: (id: number) => void;
  onCloseTab: (id: number) => void;
  onAddTab: () => void;
  tabIcon: (tab: WorkspaceTab) => React.ReactElement;
}

export function CenterPanelTabBar({
  tabs, activeTabId, dirtyTabIds, onSwitchTab, onCloseTab, onAddTab, tabIcon,
}: CenterPanelTabBarProps) {
  return (
    <div
      className="flex items-center gap-0.5 px-3 border-b flex-shrink-0 overflow-x-auto"
      style={{ height: 38, background: "rgba(255,255,255,0.01)", borderColor: "rgba(255,255,255,0.06)", scrollbarWidth: "none" }}
    >
      {tabs.map((tab) => {
        const isActive   = tab.id === activeTabId;
        const isModified = dirtyTabIds.has(tab.id);
        return (
          <div
            key={tab.id}
            onClick={() => onSwitchTab(tab.id)}
            className="flex items-center gap-1.5 pl-2.5 pr-1 rounded-md border text-xs cursor-pointer transition-all flex-shrink-0 group"
            style={{
              height: 26,
              background:   isActive ? "rgba(255,255,255,0.09)"  : "rgba(255,255,255,0.025)",
              borderColor:  isActive ? "rgba(255,255,255,0.15)"  : "rgba(255,255,255,0.06)",
              color:        isActive ? "rgba(226,232,240,0.9)"   : "rgba(148,163,184,0.55)",
            }}
            data-testid={`tab-${tab.id}`}
          >
            {tabIcon(tab)}
            <span className="whitespace-nowrap text-[11.5px]">{tab.label}</span>
            <div className="w-4 h-4 flex items-center justify-center ml-0.5">
              {isModified ? (
                <>
                  <span className="group-hover:hidden w-1.5 h-1.5 rounded-full" style={{ background: "#fbbf24" }} />
                  <button
                    onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                    className="hidden group-hover:flex w-4 h-4 items-center justify-center rounded hover:bg-white/10 transition-colors"
                    data-testid={`button-close-tab-${tab.id}`}
                  >
                    <X style={{ width: 9, height: 9 }} />
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                  data-testid={`button-close-tab-${tab.id}`}
                >
                  <X style={{ width: 9, height: 9 }} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      <button
        onClick={onAddTab}
        className={cn(
          "flex items-center gap-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors flex-shrink-0",
          tabs.length > 0 ? "w-6 h-6 justify-center" : "px-2.5 h-7",
        )}
        data-testid="button-new-tab"
      >
        <Plus style={{ width: 12, height: 12 }} />
        {tabs.length === 0 && <span>Tools &amp; files</span>}
      </button>
    </div>
  );
}
