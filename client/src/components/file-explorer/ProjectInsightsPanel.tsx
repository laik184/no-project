import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, BarChart2, FileText, Folder, Zap, Activity } from "lucide-react";
import { RawTreeNode } from "./types";
import { countTree } from "./use-file-explorer-utils";

interface ProjectInsightsPanelProps {
  tree:         RawTreeNode[];
  aiFiles:      Set<string>;
  writingFiles: Set<string>;
  dirtyFiles:   Set<string>;
}

function StatRow({ Icon, label, value, color = "#3a3a3a" }: {
  Icon: React.ElementType; label: string; value: string | number; color?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      height: 18, paddingLeft: 12, paddingRight: 8,
    }}>
      <Icon style={{ width: 9, height: 9, color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, flex: 1, color: "#3a3a3a" }}>{label}</span>
      <span style={{ fontSize: 10, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

export function ProjectInsightsPanel({
  tree, aiFiles, writingFiles, dirtyFiles,
}: ProjectInsightsPanelProps) {
  const [collapsed, setCollapsed] = useState(true);

  const { files, folders } = useMemo(() => countTree(tree), [tree]);

  const aiCount      = aiFiles.size;
  const writingCount = writingFiles.size;
  const dirtyCount   = dirtyFiles.size;

  return (
    <div style={{ flexShrink: 0, borderTop: "1px solid #1a1a1a" }}>
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 6px", height: 22, cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setCollapsed(v => !v)}
        data-testid="section-project-insights"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {collapsed
            ? <ChevronRight style={{ width: 9, height: 9, color: "#3e3e3e" }} />
            : <ChevronDown  style={{ width: 9, height: 9, color: "#3e3e3e" }} />}
          <BarChart2 style={{ width: 9, height: 9, color: "#3e3e3e" }} />
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#3e3e3e",
            textTransform: "uppercase", letterSpacing: ".08em",
          }}>
            Insights
          </span>
        </div>
        {(writingCount > 0 || dirtyCount > 0) && (
          <span style={{
            fontSize: 9, color: "#60a5fa",
            animation: writingCount > 0 ? "rfe-pulse 1s ease infinite" : "none",
          }}>
            {writingCount > 0 ? `${writingCount} writing` : `${dirtyCount} unsaved`}
          </span>
        )}
      </div>

      {!collapsed && (
        <div style={{ paddingBottom: 4 }}>
          <StatRow Icon={FileText} label="Total files"    value={files}        color="#3a3a3a" />
          <StatRow Icon={Folder}   label="Total folders"  value={folders}      color="#3a3a3a" />
          {aiCount > 0      && <StatRow Icon={Zap}      label="AI modified"  value={aiCount}      color="#60a5fa" />}
          {writingCount > 0 && <StatRow Icon={Activity}  label="Writing now"  value={writingCount} color="#34d399" />}
          {dirtyCount > 0   && <StatRow Icon={FileText}  label="Unsaved"      value={dirtyCount}   color="#f59e0b" />}
        </div>
      )}
    </div>
  );
}
