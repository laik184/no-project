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
      className="flex items-center gap-0.5 px-2 flex-shrink-0 overflow-x-auto"
      style={{
        height: 40,
        background: "rgba(255,255,255,0.008)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((tab) => {
        const isActive   = tab.id === activeTabId;
        const isModified = dirtyTabIds.has(tab.id);

        return (
          <div
            key={tab.id}
            onClick={() => onSwitchTab(tab.id)}
            className="group flex items-center gap-1.5 pl-2.5 pr-1 rounded-md cursor-pointer transition-all duration-150 flex-shrink-0 select-none"
            style={{
              height: 28,
              maxWidth: 160,
              background: isActive
                ? "rgba(255,255,255,0.10)"
                : "transparent",
              border: isActive
                ? "1px solid rgba(255,255,255,0.13)"
                : "1px solid transparent",
              color: isActive
                ? "rgba(226,232,240,0.92)"
                : "rgba(148,163,184,0.52)",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(255,255,255,0.055)";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(226,232,240,0.75)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color =
                  "rgba(148,163,184,0.52)";
              }
            }}
            data-testid={`tab-${tab.id}`}
          >
            {/* Tab icon */}
            <span className="flex-shrink-0 flex items-center">
              {tabIcon(tab)}
            </span>

            {/* Label */}
            <span
              className="text-[11.5px] font-medium whitespace-nowrap overflow-hidden"
              style={{ maxWidth: 96, textOverflow: "ellipsis" }}
            >
              {tab.label}
            </span>

            {/* Close / dirty indicator */}
            <div className="ml-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0">
              {isModified ? (
                <>
                  <span
                    className="group-hover:hidden block w-1.5 h-1.5 rounded-full"
                    style={{ background: "#fbbf24" }}
                  />
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
                  className={cn(
                    "w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 transition-colors",
                    isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
                  )}
                  data-testid={`button-close-tab-${tab.id}`}
                >
                  <X style={{ width: 9, height: 9 }} />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* ── New tab button ────────────────────────────────────────────────── */}
      <button
        onClick={onAddTab}
        className="ml-0.5 flex items-center gap-1 rounded-md text-[11px] transition-colors flex-shrink-0 hover:bg-white/6"
        style={{
          height: 28,
          padding: tabs.length > 0 ? "0 6px" : "0 10px",
          color: "rgba(148,163,184,0.45)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color =
            "rgba(148,163,184,0.75)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color =
            "rgba(148,163,184,0.45)";
        }}
        data-testid="button-new-tab"
      >
        <Plus style={{ width: 12, height: 12 }} />
        {tabs.length === 0 && (
          <span className="font-medium">Tools &amp; files</span>
        )}
      </button>
    </div>
  );
}
