import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, FilePlus, FolderPlus } from "lucide-react";
import { RawTreeNode, ClipboardState } from "./types";
import { fileIcon } from "./file-icon";
import { formatBytes } from "./use-file-explorer-utils";
import { AIActivityBadge } from "./AIActivityBadge";
import type { ActivityKind } from "./AIActivityBadge";
import { GitStatusBadge } from "./use-git-status";
import type { GitStatus } from "./use-git-status";
import { InlineInput } from "./InlineInput";

export const INDENT = 14;

export function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000)      return "just now";
  if (d < 3_600_000)   return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000)  return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 172_800_000) return "yesterday";
  if (d < 604_800_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString();
}

export function countDescendantFiles(nodes: RawTreeNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === "file") n++;
    else if (node.children) n += countDescendantFiles(node.children);
  }
  return n;
}

export function collectSearchExpanded(
  nodes: RawTreeNode[], basePath: string, sq: string, result: Set<string>,
): boolean {
  let anyMatch = false;
  for (const n of nodes) {
    const full = basePath ? `${basePath}/${n.name}` : n.name;
    if (n.type === "file") {
      if (n.name.toLowerCase().includes(sq)) anyMatch = true;
    } else if (n.children) {
      const childMatch = collectSearchExpanded(n.children, full, sq, result);
      if (childMatch) { result.add(full); anyMatch = true; }
    }
  }
  return anyMatch;
}

export function InlineCreateRow({ type, onConfirm, onCancel }: {
  type: "file" | "folder"; onConfirm: (name: string) => void; onCancel: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "2px 6px 2px 8px", height: 22,
      borderBottom: "1px solid #222", background: "#1e1e1e",
    }}>
      {type === "file"
        ? <FilePlus   style={{ width: 11, height: 11, color: "#60a5fa", flexShrink: 0 }} />
        : <FolderPlus style={{ width: 11, height: 11, color: "#e8a427", flexShrink: 0 }} />}
      <InlineInput initialValue={type === "file" ? "untitled.tsx" : "new-folder"} onConfirm={onConfirm} onCancel={onCancel} />
    </div>
  );
}

export interface RenderNodeProps {
  node: RawTreeNode; basePath: string; depth: number;
  activeFile?: string; dirtyFiles: Set<string>; aiFiles: Set<string>;
  aiActivity: Map<string, ActivityKind>;
  writingFiles: Set<string>; writingSizes: Map<string, number>;
  hoveredPath: string | null; focusedPath: string | null;
  setHoveredPath: (p: string | null) => void;
  setFocusedPath: (p: string | null) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
  searchQuery: string;
  gitStatusMap: Map<string, GitStatus>;
  selectedPaths: Set<string>; onMultiSelect: (path: string, e: React.MouseEvent) => void;
  dragSourcePath: string | null; dropTargetPath: string | null;
  onDragStart: (path: string, isDir: boolean) => void;
  onDragEnter: (path: string) => void;
  onDragEnd: () => void;
  onDrop: (sourcePath: string, targetPath: string) => void;
  folderCounts: Map<string, number>;
  forcedExpandedPaths: Set<string>;
  clipboard: ClipboardState;
  onShowMeta: (path: string, x: number, y: number) => void;
  onHideMeta: () => void;
}

export function RenderNode({
  node, basePath, depth, activeFile, dirtyFiles, aiFiles, aiActivity,
  writingFiles, writingSizes, hoveredPath, setHoveredPath,
  setFocusedPath, focusedPath, onSelect, onContextMenu, searchQuery,
  gitStatusMap, selectedPaths, onMultiSelect,
  dragSourcePath, dropTargetPath, onDragStart, onDragEnter, onDragEnd, onDrop,
  folderCounts, forcedExpandedPaths, clipboard, onShowMeta, onHideMeta,
}: RenderNodeProps) {
  const [open, setOpen] = useState(depth < 2);
  const isDir      = node.type === "folder" || node.type === "directory";
  const full       = (basePath && basePath !== "/" ? basePath + "/" : "") + node.name;
  const active     = !!activeFile && activeFile === full;
  const focused    = focusedPath === full;
  const dirty      = dirtyFiles.has(full);
  const ai         = aiFiles.has(full);
  const writing    = writingFiles.has(full);
  const writeSize  = writingSizes.get(full);
  const hovered    = hoveredPath === full;
  const activity   = aiActivity.get(full);
  const gitSt      = gitStatusMap.get(full);
  const isSelected = selectedPaths.has(full);
  const isDragging = dragSourcePath === full;
  const isDropTgt  = isDir && dropTargetPath === full;
  const isCut      = clipboard?.op === "cut" && clipboard.path === full;
  const effectiveOpen = isDir && (forcedExpandedPaths.has(full) || open);

  useEffect(() => {
    const handler = (e: Event) => {
      const { path, expanded } = (e as CustomEvent).detail ?? {};
      if (path === full) setOpen(expanded);
    };
    window.addEventListener("rfe:set-expanded", handler);
    return () => window.removeEventListener("rfe:set-expanded", handler);
  }, [full]);

  const sq = searchQuery.trim().toLowerCase();
  if (sq && !node.name.toLowerCase().includes(sq) && !isDir) return null;

  const highlightName = (name: string): React.ReactNode => {
    if (!sq) return name;
    const idx = name.toLowerCase().indexOf(sq);
    if (idx === -1) return name;
    return (<>{name.slice(0, idx)}<span style={{ color: "#fbbf24", fontWeight: 600 }}>{name.slice(idx, idx + sq.length)}</span>{name.slice(idx + sq.length)}</>);
  };

  const paddingLeft = 4 + depth * INDENT;
  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4,
    height: 20, paddingRight: 4, paddingLeft,
    cursor: isDragging ? "grabbing" : "pointer",
    userSelect: "none", fontSize: 12, position: "relative",
    borderLeft: active ? "2px solid #3b82f6" : writing ? "2px solid #60a5fa" : dirty ? "2px solid #f59e0b" : "2px solid transparent",
    background: isDropTgt ? "rgba(59,130,246,.18)" : isDragging ? "rgba(59,130,246,.04)" : isSelected ? "rgba(59,130,246,.1)"
      : writing ? "rgba(59,130,246,.06)" : active ? "#2a2a2a" : focused ? "#1e2a3a" : hovered ? "#202020" : "transparent",
    color: active ? "#f0f0f0" : "#b4b4b4",
    transition: "background .1s, color .1s",
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: isDropTgt ? "1px dashed rgba(59,130,246,.5)" : focused ? "1px solid rgba(59,130,246,.3)" : "none",
    outlineOffset: "-1px", opacity: isDragging ? 0.5 : isCut ? 0.4 : 1,
  };

  const guides = Array.from({ length: depth }).map((_, i) => (
    <span key={i} style={{ position: "absolute", left: 4 + i * INDENT + 5, top: 0, bottom: 0, width: 1, background: "#202020", pointerEvents: "none" }} />
  ));

  const dragHandlers = {
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; onDragStart(full, isDir); },
    onDragOver:  (e: React.DragEvent) => {
      if (isDir && dragSourcePath && dragSourcePath !== full && !full.startsWith(dragSourcePath + "/")) {
        e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; onDragEnter(full);
      }
    },
    onDragLeave: (e: React.DragEvent) => e.stopPropagation(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (dragSourcePath && dragSourcePath !== full) onDrop(dragSourcePath, full);
    },
    onDragEnd: (e: React.DragEvent) => { e.stopPropagation(); onDragEnd(); },
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) { onMultiSelect(full, e); }
    else { setFocusedPath(full); onMultiSelect(full, e); if (!isDir) onSelect(full); else setOpen(v => !v); }
  };

  const badge = writing ? (
    <span className="rfe-badge"><span className="rfe-spinner" />{writeSize !== undefined ? formatBytes(writeSize) : "…"}</span>
  ) : activity ? (<AIActivityBadge activity={activity} />
  ) : ai ? (<AIActivityBadge activity="editing" />
  ) : dirty ? (
    <span title="Modified" style={{ fontSize: 9, padding: "0 3px", borderRadius: 2, background: "rgba(245,158,11,.15)", color: "#f59e0b", flexShrink: 0, letterSpacing: .2 }}>M</span>
  ) : gitSt ? (<GitStatusBadge status={gitSt} />) : null;

  const folderCount = isDir ? folderCounts.get(full) : undefined;
  const sharedProps = { style: rowStyle, onClick: handleClick, "data-tree-row": "true", "data-tree-path": full, ...dragHandlers };

  if (isDir) {
    return (
      <div>
        <div {...sharedProps} role="treeitem" aria-expanded={effectiveOpen} aria-selected={active}
          tabIndex={focused ? 0 : -1} data-tree-type="folder" data-tree-expanded={String(effectiveOpen)}
          onContextMenu={e => onContextMenu(e, full, true)}
          onMouseEnter={() => { setHoveredPath(full); onHideMeta(); }}
          onMouseLeave={() => setHoveredPath(null)} data-testid={`folder-${node.name}`}>
          {guides}
          <span style={{ color: "#4a4a4a", flexShrink: 0, display: "flex", zIndex: 1 }}>
            {effectiveOpen ? <ChevronDown style={{ width: 11, height: 11 }} /> : <ChevronRight style={{ width: 11, height: 11 }} />}
          </span>
          {fileIcon(node.name, "folder", effectiveOpen)}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: hovered || active ? "#d4d4d4" : "#9a9a9a" }}>
            {highlightName(node.name)}
          </span>
          {folderCount !== undefined && folderCount > 0 && (
            <span style={{ fontSize: 9, color: "#2e2e2e", marginLeft: 2, flexShrink: 0 }}>{folderCount}</span>
          )}
          {badge}
        </div>
        {effectiveOpen && (
          <div role="group">
            {Array.isArray(node.children) && node.children.map(child => (
              <RenderNode key={child.name} node={child} basePath={full} depth={depth + 1}
                activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles}
                aiActivity={aiActivity} writingFiles={writingFiles} writingSizes={writingSizes}
                hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
                focusedPath={focusedPath} setFocusedPath={setFocusedPath}
                onSelect={onSelect} onContextMenu={onContextMenu} searchQuery={searchQuery}
                gitStatusMap={gitStatusMap} selectedPaths={selectedPaths} onMultiSelect={onMultiSelect}
                dragSourcePath={dragSourcePath} dropTargetPath={dropTargetPath}
                onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd} onDrop={onDrop}
                folderCounts={folderCounts} forcedExpandedPaths={forcedExpandedPaths}
                clipboard={clipboard} onShowMeta={onShowMeta} onHideMeta={onHideMeta}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div {...sharedProps} role="treeitem" aria-selected={active}
      tabIndex={focused ? 0 : -1} data-tree-type="file" data-tree-expanded="false"
      onContextMenu={e => onContextMenu(e, full, false)}
      onMouseEnter={e => { setHoveredPath(full); onShowMeta(full, e.clientX, e.clientY); }}
      onMouseLeave={() => { setHoveredPath(null); onHideMeta(); }}
      data-testid={`file-${node.name}`}>
      {guides}
      <span style={{ width: 11, flexShrink: 0, zIndex: 1 }} />
      {fileIcon(node.name, "file")}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{highlightName(node.name)}</span>
      {badge}
    </div>
  );
}
