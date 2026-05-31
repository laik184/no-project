import { useState } from "react";
import { ChevronRight, ChevronDown, Clock } from "lucide-react";
import { fileIcon } from "./file-icon";

interface RecentFilesPanelProps {
  files:       string[];
  activeFile?: string;
  onSelect:    (path: string) => void;
}

export function RecentFilesPanel({ files, activeFile, onSelect }: RecentFilesPanelProps) {
  const [collapsed, setCollapsed]     = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  if (files.length === 0) return null;

  return (
    <div style={{ flexShrink: 0, borderBottom: "1px solid #1a1a1a" }}>
      {/* ── Section header ── */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 3,
          padding: "0 4px 0 6px", height: 22, cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setCollapsed(v => !v)}
        data-testid="section-recent-files"
        role="button"
        aria-expanded={!collapsed}
      >
        {collapsed
          ? <ChevronRight style={{ width: 10, height: 10, color: "#484848" }} />
          : <ChevronDown  style={{ width: 10, height: 10, color: "#484848" }} />}
        <Clock style={{ width: 9, height: 9, color: "#484848" }} />
        <span style={{
          fontSize: 10, fontWeight: 600, color: "#484848",
          textTransform: "uppercase", letterSpacing: ".08em", marginLeft: 1,
        }}>
          Recent
        </span>
        <span style={{ fontSize: 9, color: "#333", marginLeft: 3 }}>{files.length}</span>
      </div>

      {/* ── File rows ── */}
      {!collapsed && files.map(path => {
        const name    = path.split("/").pop() ?? path;
        const dir     = path.split("/").slice(0, -1).pop() ?? "";
        const isActive = activeFile === path;
        const isHov    = hoveredPath === path;

        return (
          <div
            key={path}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              height: 22, paddingLeft: 14, paddingRight: 6,
              cursor: "pointer", userSelect: "none",
              borderLeft: isActive ? "2px solid #3b82f6" : "2px solid transparent",
              background: isActive ? "#2a2a2a" : isHov ? "#1e1e1e" : "transparent",
              transition: "background .1s",
            }}
            onMouseEnter={() => setHoveredPath(path)}
            onMouseLeave={() => setHoveredPath(null)}
            onClick={() => onSelect(path)}
            data-testid={`recent-file-${name}`}
            role="button"
            aria-label={`Open recent file ${name}`}
          >
            {fileIcon(name, "file")}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
                color: isActive ? "#f0f0f0" : "#6a6a6a",
              }}>
                {name}
              </div>
              {dir && (
                <div style={{
                  fontSize: 10, color: "#383838",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {dir}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
