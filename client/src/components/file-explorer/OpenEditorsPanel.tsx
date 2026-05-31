import { useState } from "react";
import { ChevronRight, ChevronDown, X } from "lucide-react";
import { fileIcon } from "./file-icon";

interface OpenEditorsPanelProps {
  files:       string[];
  activeFile?: string;
  onSelect:    (path: string) => void;
  onClose:     (path: string) => void;
  onCloseAll:  () => void;
}

export function OpenEditorsPanel({
  files, activeFile, onSelect, onClose, onCloseAll,
}: OpenEditorsPanelProps) {
  const [collapsed, setCollapsed]   = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  if (files.length === 0) return null;

  return (
    <div style={{ flexShrink: 0, borderBottom: "1px solid #1a1a1a" }}>
      {/* ── Section header ── */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 4px 0 6px", height: 22, cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setCollapsed(v => !v)}
        data-testid="section-open-editors"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {collapsed
            ? <ChevronRight style={{ width: 10, height: 10, color: "#484848" }} />
            : <ChevronDown  style={{ width: 10, height: 10, color: "#484848" }} />}
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#484848",
            textTransform: "uppercase", letterSpacing: ".08em",
          }}>
            Open Editors
          </span>
          <span style={{ fontSize: 9, color: "#333", marginLeft: 3 }}>{files.length}</span>
        </div>
        {!collapsed && (
          <button
            onClick={(e) => { e.stopPropagation(); onCloseAll(); }}
            title="Close all editors"
            data-testid="button-close-all-editors"
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

      {/* ── File rows ── */}
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
              borderLeft: isActive ? "2px solid #3b82f6" : "2px solid transparent",
              background: isActive ? "#2a2a2a" : isHov ? "#1e1e1e" : "transparent",
              transition: "background .1s",
            }}
            onMouseEnter={() => setHoveredPath(path)}
            onMouseLeave={() => setHoveredPath(null)}
            onClick={() => onSelect(path)}
            data-testid={`open-editor-${name}`}
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
                onClick={(e) => { e.stopPropagation(); onClose(path); }}
                data-testid={`close-editor-${name}`}
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
