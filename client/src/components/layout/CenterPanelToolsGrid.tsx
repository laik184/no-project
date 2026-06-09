import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { toolItems } from "./center-panel-tools";
import type { WorkspaceTab } from "./editor-toolbar";

interface CenterPanelToolsGridProps {
  onToolSelect: (label: string, url: string) => void;
  onTabJump?: (tabId: number) => void;
  existingTabs?: WorkspaceTab[];
  tabIcon?: (tab: WorkspaceTab) => React.ReactElement;
}

export function CenterPanelToolsGrid({
  onToolSelect,
  onTabJump,
  existingTabs = [],
  tabIcon,
}: CenterPanelToolsGridProps) {
  const [query, setQuery] = useState("");

  const filteredTools = useMemo(() => {
    if (!query.trim()) return toolItems;
    const q = query.toLowerCase();
    return toolItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.sub.toLowerCase().includes(q),
    );
  }, [query]);

  const filteredTabs = useMemo(() => {
    const openTabs = existingTabs.filter((t) => t.url || t.fileContent !== undefined);
    if (!query.trim()) return openTabs;
    const q = query.toLowerCase();
    return openTabs.filter((t) => t.label.toLowerCase().includes(q));
  }, [query, existingTabs]);

  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      style={{ background: "rgba(255,255,255,0.01)", scrollbarWidth: "thin" }}
    >
      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: 13, height: 13, color: "rgba(148,163,184,0.45)" }}
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for tools & files..."
            className="w-full pl-8 pr-4 rounded-lg text-sm outline-none transition-all"
            style={{
              height: 38,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(226,232,240,0.9)",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.border =
                "1px solid rgba(124,141,255,0.35)";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.07)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.border =
                "1px solid rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLElement).style.background =
                "rgba(255,255,255,0.05)";
            }}
            data-testid="input-newtab-search"
          />
        </div>
      </div>

      <div className="px-5 pb-8 space-y-5">
        {/* ── Jump to existing tab ─────────────────────────────────────────── */}
        {filteredTabs.length > 0 && (
          <section>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: "rgba(148,163,184,0.38)" }}
            >
              Jump to existing tab
            </p>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {filteredTabs.map((tab, i) => (
                <button
                  key={tab.id}
                  onClick={() => onTabJump?.(tab.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{
                    borderBottom:
                      i < filteredTabs.length - 1
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                  }}
                  data-testid={`button-jump-tab-${tab.id}`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {tabIcon ? tabIcon(tab) : null}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[13px] font-medium truncate"
                      style={{ color: "rgba(226,232,240,0.88)" }}
                    >
                      {tab.label}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "rgba(148,163,184,0.45)" }}
                    >
                      {tab.fileContent !== undefined
                        ? "Open file"
                        : "Open tab"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Suggested / search results ────────────────────────────────────── */}
        <section>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "rgba(148,163,184,0.38)" }}
          >
            {query.trim() ? "Results" : "Suggested"}
          </p>

          {filteredTools.length === 0 ? (
            <div
              className="rounded-xl px-4 py-8 text-center text-[12px]"
              style={{
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(148,163,184,0.4)",
              }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {filteredTools.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onToolSelect(item.label, item.url)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors"
                    style={{
                      borderBottom:
                        i < filteredTools.length - 1
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "none",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "";
                    }}
                    data-testid={`button-newtab-tool-${item.id}`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: item.bg,
                        border: "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      <Icon style={{ width: 15, height: 15, color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] font-semibold leading-tight"
                        style={{ color: "rgba(226,232,240,0.9)" }}
                      >
                        {item.label}
                      </p>
                      <p
                        className="text-[11px] leading-snug mt-0.5 line-clamp-2"
                        style={{ color: "rgba(148,163,184,0.5)" }}
                      >
                        {item.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
