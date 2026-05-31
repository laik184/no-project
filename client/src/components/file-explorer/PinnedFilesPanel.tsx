import { useState } from "react";
import { ChevronRight, ChevronDown, Pin, X } from "lucide-react";
import { fileIcon } from "./file-icon";

interface PinnedFilesPanelProps {
  files:       string[];
  activeFile?: string;
  onSelect:    (path: string) => void;
  onUnpin:     (path: string) => void;
  onClearAll:  () => void;
}

export function PinnedFilesPanel({
  files, activeFile, onSelect, onUnpin, onClearAll,
}: PinnedFilesPanelProps) {
  const [collapsed, setCollapsed]     = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  if (files.length === 0) return null;

  return (
    <div style={{ flexShrink: 0, borderBottom: "1px solid #1a1a1a" }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 4px 0 6px", height: 22, cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setCollapsed(v => !v)}
        data-testid="section-pinned-files"
        role="button"
        aria-expanded={!collapsed}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {collapsed
            ? <ChevronRight style={{ width: 10, height: 10, color: "#484848" }} />
            : <ChevronDown  style={{ width: 10, height: 10, color: "#484848" }} />}
          <Pin style={{ width: 9, height: 9, color: "#484848" }} />
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#484848",
            textTransform: "uppercase", letterSpacing: ".08em", marginLeft: 1,
          }}>
            Pinned
          </span>
          <span style={{ fontSize: 9, color: "#333", marginLeft: 3 }}>{files.length}</span>
        </div>
        {!collapsed && (
          <button
            onClick={(e) => { e.stopPropagation(); onClearAll(); }}
            title="Clear all pinned files"
            data-testid="button-clear-pinned"
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 2, color: "#333", display: "flex", borderRadius: 2,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#888"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#333"; }}
          >
            <X style={{ width: 9, height: 9 }} />
          </button>
        )}
      </div>

      {!collapsed && files.map(path => {
        const name     = path.split("/").pop() ?? path;
        const isActive = activeFile === path;
        const isHov    = hoveredPath === path;

        return (
          <div
            key={path}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              height: 20, paddingLeft: 14, paddingRight: 4,
              cursor: "pointer", userSelect: "none",
              borderLeft: isActive ? "2px solid #a78bfa" : "2px solid transparent",
              background: isActive ? "#2a2a2a" : isHov ? "#1e1e1e" : "transparent",
              transition: "background .1s",
            }}
            onMouseEnter={() => setHoveredPath(path)}
            onMouseLeave={() => setHoveredPath(null)}
            onClick={() => onSelect(path)}
            data-testid={`pinned-file-${name}`}
          >
            {fileIcon(name, "file")}
            <span style={{
              flex: 1, fontSize: 12, overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
              color: isActive ? "#f0f0f0" : "#6a6a6a",
            }}>
              {name}
            </span>
            {isHov && (
              <button
                onClick={(e) => { e.stopPropagation(); onUnpin(path); }}
                title="Unpin"
                data-testid={`unpin-${name}`}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: 2, color: "#555", display: "flex",
                  borderRadius: 2, flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c4c4c4"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#555"; }}
              >
                <X style={{ width: 9, height: 9 }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
