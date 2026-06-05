import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RawTreeNode, ClipboardState } from "./types";
import { fileIcon } from "./file-icon";
import { formatBytes } from "./use-file-explorer-utils";
import { AIActivityBadge } from "./AIActivityBadge";
import type { ActivityKind } from "./AIActivityBadge";
import { GitStatusBadge } from "./use-git-status";
import type { GitStatus } from "./use-git-status";
import { INDENT } from "./tree-node-utils";
import { NodeRowMenu, MoreBtn } from "./tree-node-menu";
import type { MenuAction } from "./tree-node-menu";

export { INDENT, timeAgo, countDescendantFiles, collectSearchExpanded, InlineCreateRow } from "./tree-node-utils";

function hasMatchingDescendant(nodes: RawTreeNode[], sq: string): boolean {
  for (const n of nodes) {
    if (n.name.toLowerCase().includes(sq)) return true;
    if ((n.type === "folder" || n.type === "directory") && n.children) {
      if (hasMatchingDescendant(n.children, sq)) return true;
    }
  }
  return false;
}

export interface RenderNodeProps {
  node: RawTreeNode; basePath: string; depth: number;
  activeFile?: string; dirtyFiles: Set<string>; aiFiles: Set<string>;
  aiActivity: Map<string, ActivityKind>; writingFiles: Set<string>; writingSizes: Map<string, number>;
  hoveredPath: string | null; focusedPath: string | null;
  setHoveredPath: (p: string | null) => void; setFocusedPath: (p: string | null) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
  searchQuery: string; gitStatusMap: Map<string, GitStatus>;
  selectedPaths: Set<string>; onMultiSelect: (path: string, e: React.MouseEvent) => void;
  dragSourcePath: string | null; dropTargetPath: string | null;
  onDragStart: (path: string, isDir: boolean) => void; onDragEnter: (path: string) => void;
  onDragEnd: () => void; onDrop: (src: string, dest: string) => void;
  folderCounts: Map<string, number>; forcedExpandedPaths: Set<string>;
  clipboard: ClipboardState;
  onShowMeta: (path: string, x: number, y: number) => void; onHideMeta: () => void;
  onRowMenuAction: (action: MenuAction, path: string, isDir: boolean) => void;
}

export function RenderNode({
  node, basePath, depth, activeFile, dirtyFiles, aiFiles, aiActivity,
  writingFiles, writingSizes, hoveredPath, setHoveredPath, setFocusedPath,
  focusedPath, onSelect, onContextMenu, searchQuery, gitStatusMap,
  selectedPaths, onMultiSelect, dragSourcePath, dropTargetPath,
  onDragStart, onDragEnter, onDragEnd, onDrop,
  folderCounts, forcedExpandedPaths, clipboard, onShowMeta, onHideMeta,
  onRowMenuAction,
}: RenderNodeProps) {
  const [open, setOpen]       = useState(depth < 2);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

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

  const sq = searchQuery;
  if (sq) {
    const nameMatches = node.name.toLowerCase().includes(sq);
    if (!isDir) {
      if (!nameMatches) return null;
    } else {
      if (!nameMatches && !hasMatchingDescendant(node.children ?? [], sq)) return null;
    }
  }

  const highlightName = (name: string): React.ReactNode => {
    if (!sq) return name;
    const idx = name.toLowerCase().indexOf(sq);
    if (idx === -1) return name;
    return (
      <>
        {name.slice(0, idx)}
        <span style={{ color: "#fbbf24", fontWeight: 600 }}>{name.slice(idx, idx + sq.length)}</span>
        {name.slice(idx + sq.length)}
      </>
    );
  };

  const paddingLeft = 4 + depth * INDENT;
  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4, height: 22, paddingRight: 4, paddingLeft,
    cursor: isDragging ? "grabbing" : "pointer", userSelect: "none", fontSize: 12,
    position: "relative",
    borderLeft: active ? "2px solid #3b82f6" : writing ? "2px solid #60a5fa" : dirty ? "2px solid #f59e0b" : "2px solid transparent",
    background: isDropTgt ? "rgba(59,130,246,.18)" : isDragging ? "rgba(59,130,246,.04)" : isSelected ? "rgba(59,130,246,.1)" : writing ? "rgba(59,130,246,.06)" : active ? "#2a2a2a" : focused ? "#1e2a3a" : hovered ? "#202020" : "transparent",
    color: active ? "#f0f0f0" : "#b4b4b4",
    transition: "background .1s, color .1s",
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: isDropTgt ? "1px dashed rgba(59,130,246,.5)" : focused ? "1px solid rgba(59,130,246,.3)" : "none",
    outlineOffset: "-1px",
    opacity: isDragging ? 0.5 : isCut ? 0.4 : 1,
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
    onDrop: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (dragSourcePath && dragSourcePath !== full) onDrop(dragSourcePath, full); },
    onDragEnd: (e: React.DragEvent) => { e.stopPropagation(); onDragEnd(); },
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) { onMultiSelect(full, e); }
    else { setFocusedPath(full); onMultiSelect(full, e); if (!isDir) onSelect(full); else setOpen(v => !v); }
  };

  const openMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onHideMeta();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: rect.right + 4, y: rect.top - 4 });
  }, [onHideMeta]);

  const badge = (hovered || menuPos !== null) ? null :
    writing ? (
      <span className="rfe-badge"><span className="rfe-spinner" />{writeSize !== undefined ? formatBytes(writeSize) : "…"}</span>
    ) : activity ? <AIActivityBadge activity={activity} />
    : ai      ? <AIActivityBadge activity="editing" />
    : dirty   ? <span title="Modified" style={{ fontSize: 9, padding: "0 3px", borderRadius: 2, background: "rgba(245,158,11,.15)", color: "#f59e0b", flexShrink: 0, letterSpacing: .2 }}>M</span>
    : gitSt   ? <GitStatusBadge status={gitSt} />
    : null;

  const folderCount = isDir ? folderCounts.get(full) : undefined;
  const sharedProps = {
    style: rowStyle, onClick: handleClick,
    "data-tree-row": "true", "data-tree-path": full,
    ...dragHandlers,
  };

  const menu = menuPos ? (
    <NodeRowMenu
      x={menuPos.x} y={menuPos.y}
      isDir={isDir}
      onAction={action => onRowMenuAction(action, full, isDir)}
      onClose={() => setMenuPos(null)}
    />
  ) : null;

  if (isDir) {
    return (
      <div>
        <div {...sharedProps} role="treeitem" aria-expanded={effectiveOpen} aria-selected={active}
          tabIndex={focused ? 0 : -1} data-tree-type="folder" data-tree-expanded={String(effectiveOpen)}
          onContextMenu={e => onContextMenu(e, full, true)}
          onMouseEnter={() => { setHoveredPath(full); onHideMeta(); }}
          onMouseLeave={() => setHoveredPath(null)}
          data-testid={`folder-${node.name}`}>
          {guides}
          <span style={{ color: "#4a4a4a", flexShrink: 0, display: "flex", zIndex: 1 }}>
            {effectiveOpen ? <ChevronDown style={{ width: 11, height: 11 }} /> : <ChevronRight style={{ width: 11, height: 11 }} />}
          </span>
          {fileIcon(node.name, "folder", effectiveOpen)}
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: hovered || active ? "#d4d4d4" : "#9a9a9a" }}>
            {highlightName(node.name)}
          </span>
          {folderCount !== undefined && folderCount > 0 && !hovered && !menuPos && (
            <span style={{ fontSize: 9, color: "#3e3e3e", marginLeft: 2, flexShrink: 0 }}>{folderCount}</span>
          )}
          {badge}
          <MoreBtn nodeName={node.name} menuPos={menuPos} hovered={hovered} onClick={openMenu} />
        </div>
        {menu}
        {effectiveOpen && (
          <div role="group">
            {Array.isArray(node.children) && node.children.map(child => (
              <RenderNode key={child.name} node={child} basePath={full} depth={depth + 1}
                activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles} aiActivity={aiActivity}
                writingFiles={writingFiles} writingSizes={writingSizes}
                hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
                focusedPath={focusedPath} setFocusedPath={setFocusedPath}
                onSelect={onSelect} onContextMenu={onContextMenu} searchQuery={searchQuery}
                gitStatusMap={gitStatusMap} selectedPaths={selectedPaths} onMultiSelect={onMultiSelect}
                dragSourcePath={dragSourcePath} dropTargetPath={dropTargetPath}
                onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd} onDrop={onDrop}
                folderCounts={folderCounts} forcedExpandedPaths={forcedExpandedPaths}
                clipboard={clipboard} onShowMeta={onShowMeta} onHideMeta={onHideMeta}
                onRowMenuAction={onRowMenuAction}
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
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {highlightName(node.name)}
      </span>
      {badge}
      <MoreBtn nodeName={node.name} menuPos={menuPos} hovered={hovered} onClick={openMenu} />
      {menu}
    </div>
  );
}
