import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDown, ChevronRight, FilePlus, FolderPlus,
  MoreHorizontal, Pencil, Search, ChevronsDownUp,
  Terminal, Copy, Link2, Download, Trash2,
} from "lucide-react";
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

function hasMatchingDescendant(nodes: RawTreeNode[], sq: string): boolean {
  for (const n of nodes) {
    if (n.name.toLowerCase().includes(sq)) return true;
    if ((n.type === "folder" || n.type === "directory") && n.children) {
      if (hasMatchingDescendant(n.children, sq)) return true;
    }
  }
  return false;
}

export function InlineCreateRow({
  type, onConfirm, onCancel,
}: { type: "file" | "folder"; onConfirm: (name: string) => void; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 6px 2px 8px", height: 22, borderBottom: "1px solid #222", background: "#1e1e1e" }}>
      {type === "file"
        ? <FilePlus style={{ width: 11, height: 11, color: "#60a5fa", flexShrink: 0 }} />
        : <FolderPlus style={{ width: 11, height: 11, color: "#e8a427", flexShrink: 0 }} />}
      <InlineInput
        initialValue={type === "file" ? "untitled.tsx" : "new-folder"}
        onConfirm={onConfirm} onCancel={onCancel}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NodeRowMenu — the 3-dot dropdown
// ─────────────────────────────────────────────────────────────────────────────

type MenuAction =
  | "rename" | "search-dir" | "new-file" | "new-folder"
  | "collapse" | "open-shell" | "copy-path" | "copy-link"
  | "download" | "delete";

interface MenuEntry {
  icon:    React.ElementType;
  label:   string;
  action:  MenuAction;
  danger?: boolean;
}
type MenuRow = MenuEntry | "divider";

const DIR_MENU: MenuRow[] = [
  { icon: Pencil,        label: "Rename",               action: "rename"     },
  { icon: Search,        label: "Search this directory", action: "search-dir" },
  { icon: FilePlus,      label: "Add file",              action: "new-file"   },
  { icon: FolderPlus,    label: "Add folder",            action: "new-folder" },
  { icon: ChevronsDownUp,label: "Collapse child folders",action: "collapse"   },
  { icon: Terminal,      label: "Open shell here",       action: "open-shell" },
  "divider",
  { icon: Copy,          label: "Copy file path",        action: "copy-path"  },
  { icon: Link2,         label: "Copy link",             action: "copy-link"  },
  "divider",
  { icon: Download,      label: "Download folder",       action: "download"   },
  "divider",
  { icon: Trash2,        label: "Delete",                action: "delete",   danger: true },
];

const FILE_MENU: MenuRow[] = [
  { icon: Pencil,   label: "Rename",        action: "rename"    },
  "divider",
  { icon: Copy,     label: "Copy file path",action: "copy-path" },
  { icon: Link2,    label: "Copy link",     action: "copy-link" },
  "divider",
  { icon: Download, label: "Download",      action: "download"  },
  "divider",
  { icon: Trash2,   label: "Delete",        action: "delete",  danger: true },
];

interface NodeRowMenuProps {
  x: number; y: number;
  isDir: boolean;
  onAction: (action: MenuAction) => void;
  onClose: () => void;
}

function NodeRowMenu({ x, y, isDir, onAction, onClose }: NodeRowMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const items = isDir ? DIR_MENU : FILE_MENU;

  // Clamp to viewport
  const tipX = Math.min(x, window.innerWidth  - 210);
  const tipY = Math.min(y, window.innerHeight - (isDir ? 380 : 210));

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", down, true);
    document.addEventListener("keydown",   key,  true);
    return () => {
      document.removeEventListener("mousedown", down, true);
      document.removeEventListener("keydown",   key,  true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed", top: tipY, left: tipX, zIndex: 99999,
        background: "#1a1a1a", border: "1px solid #2a2a2a",
        borderRadius: 8, padding: "3px",
        boxShadow: "0 8px 28px rgba(0,0,0,.75), 0 2px 8px rgba(0,0,0,.4)",
        minWidth: 196,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      data-testid="row-context-menu"
    >
      {items.map((row, i) => {
        if (row === "divider") {
          return <div key={`d-${i}`} style={{ height: 1, background: "#252525", margin: "2px 3px" }} />;
        }
        const { icon: Icon, label, action, danger } = row;
        return (
          <div
            key={action}
            role="menuitem"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); onAction(action); onClose(); }}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "5px 11px", borderRadius: 5, cursor: "pointer",
              fontSize: 12.5, color: danger ? "#f87171" : "#b4b4b4",
              transition: "background .08s, color .08s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = danger ? "rgba(239,68,68,.12)" : "#252525";
              (e.currentTarget as HTMLElement).style.color      = danger ? "#ef4444"             : "#f0f0f0";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color      = danger ? "#f87171" : "#b4b4b4";
            }}
            data-testid={`row-menu-${action}`}
          >
            <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
            {label}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RenderNode
// ─────────────────────────────────────────────────────────────────────────────

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
  const [open, setOpen]                 = useState(depth < 2);
  const [menuPos, setMenuPos]           = useState<{ x: number; y: number } | null>(null);
  const menuBtnRef                      = useRef<HTMLButtonElement>(null);

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

  // ── Search filter ──────────────────────────────────────────────────────────
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

  // ── 3-dot button ──────────────────────────────────────────────────────────
  const moreBtn = (hovered || menuPos !== null) && (
    <button
      ref={menuBtnRef}
      onClick={openMenu}
      onMouseDown={e => e.stopPropagation()}
      title="More options"
      data-testid={`btn-more-${node.name}`}
      style={{
        flexShrink: 0, background: menuPos ? "#333" : "transparent",
        border: "none", cursor: "pointer", borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 18, height: 18, color: "#888",
        transition: "background .1s, color .1s",
        marginLeft: "auto",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#333"; (e.currentTarget as HTMLElement).style.color = "#d4d4d4"; }}
      onMouseLeave={e => { if (!menuPos) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#888"; } }}
    >
      <MoreHorizontal style={{ width: 13, height: 13 }} />
    </button>
  );

  // ── Status badge (hidden while 3-dot is showing) ──────────────────────────
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
          {moreBtn}
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
      {moreBtn}
      {menu}
    </div>
  );
}
