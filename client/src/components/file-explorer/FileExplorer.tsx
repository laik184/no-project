import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  FilePlus, FolderPlus, RotateCcw, Search, X,
  ChevronDown, ChevronRight, FolderUp,
} from "lucide-react";
import { RawTreeNode, ContextMenuState, ClipboardState, FileMeta } from "./types";
import { fileIcon } from "./file-icon";
import { useFileExplorer } from "./use-file-explorer";
import { countTree, formatBytes } from "./use-file-explorer-utils";
import { useOpenEditors } from "./use-open-editors";
import { useRecentFiles } from "./use-recent-files";
import { usePinnedFiles } from "./use-pinned-files";
import { PinnedFilesPanel } from "./PinnedFilesPanel";
import { OpenEditorsPanel } from "./OpenEditorsPanel";
import { RecentFilesPanel } from "./RecentFilesPanel";
import { AgentStatusPanel } from "./AgentStatusPanel";
import { ProjectInsightsPanel } from "./ProjectInsightsPanel";
import { ContextMenu } from "./ContextMenu";
import { InlineInput } from "./InlineInput";
import { AIActivityBadge } from "./AIActivityBadge";
import type { ActivityKind } from "./AIActivityBadge";
import { useGitStatus, GitStatusBadge } from "./use-git-status";
import type { GitStatus } from "./use-git-status";
import FileHistoryPanel from "./FileHistoryPanel";

export { countTree, formatBytes } from "./use-file-explorer-utils";

interface FileExplorerProps {
  projectPath?: string;
  onSelect?:    (path: string) => void;
  onFileSelect?:(path: string) => void;
  activeFile?:  string;
}

const INDENT    = 14;
const MIN_W     = 160;
const MAX_W     = 480;
const WIDTH_KEY = "rfe_sidebar_width";

const loadWidth = () => {
  try { const s = localStorage.getItem(WIDTH_KEY); return s ? Math.min(MAX_W, Math.max(MIN_W, parseInt(s, 10))) : 220; }
  catch { return 220; }
};

function timeAgo(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000)     return "just now";
  if (d < 3_600_000)  return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 172_800_000) return "yesterday";
  if (d < 604_800_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString();
}

// ── Helper: count all files under a node subtree ────────────────────────────
function countDescendantFiles(nodes: RawTreeNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === "file") n++;
    else if (node.children) n += countDescendantFiles(node.children);
  }
  return n;
}

// ── Helper: collect folder paths that have matching file descendants ──────────
function collectSearchExpanded(
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

// ── RenderNode ────────────────────────────────────────────────────────────────
function RenderNode({
  node, basePath, depth, activeFile, dirtyFiles, aiFiles, aiActivity,
  writingFiles, writingSizes, hoveredPath, setHoveredPath,
  setFocusedPath, focusedPath, onSelect, onContextMenu, searchQuery,
  gitStatusMap, selectedPaths, onMultiSelect,
  dragSourcePath, dropTargetPath, onDragStart, onDragEnter, onDragEnd, onDrop,
  folderCounts, forcedExpandedPaths, clipboard, onShowMeta, onHideMeta,
}: {
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
  selectedPaths: Set<string>;
  onMultiSelect: (path: string, e: React.MouseEvent) => void;
  dragSourcePath: string | null;
  dropTargetPath: string | null;
  onDragStart: (path: string, isDir: boolean) => void;
  onDragEnter: (path: string) => void;
  onDragEnd: () => void;
  onDrop: (sourcePath: string, targetPath: string) => void;
  // P3 new props
  folderCounts:        Map<string, number>;
  forcedExpandedPaths: Set<string>;
  clipboard:           ClipboardState;
  onShowMeta:          (path: string, x: number, y: number) => void;
  onHideMeta:          () => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isDir       = node.type === "folder" || node.type === "directory";
  const full        = (basePath && basePath !== "/" ? basePath + "/" : "") + node.name;
  const active      = !!activeFile && activeFile === full;
  const focused     = focusedPath === full;
  const dirty       = dirtyFiles.has(full);
  const ai          = aiFiles.has(full);
  const writing     = writingFiles.has(full);
  const writeSize   = writingSizes.get(full);
  const hovered     = hoveredPath === full;
  const activity    = aiActivity.get(full);
  const gitSt       = gitStatusMap.get(full);
  const isSelected  = selectedPaths.has(full);
  const isDragging  = dragSourcePath === full;
  const isDropTgt   = isDir && dropTargetPath === full;
  const isCut       = clipboard?.op === "cut" && clipboard.path === full;

  // P3 #6 — forced expansion for search results
  const effectiveOpen = isDir && (forcedExpandedPaths.has(full) || open);

  // P1 #4 — keyboard expand/collapse via custom event
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
    display: "flex", alignItems: "center", gap: 4,
    height: 20, paddingRight: 4, paddingLeft,
    cursor: isDragging ? "grabbing" : "pointer",
    userSelect: "none", fontSize: 12, position: "relative",
    borderLeft: active   ? "2px solid #3b82f6"
      : writing          ? "2px solid #60a5fa"
      : dirty            ? "2px solid #f59e0b"
      :                    "2px solid transparent",
    background: isDropTgt   ? "rgba(59,130,246,.18)"
      : isDragging          ? "rgba(59,130,246,.04)"
      : isSelected          ? "rgba(59,130,246,.1)"
      : writing             ? "rgba(59,130,246,.06)"
      : active              ? "#2a2a2a"
      : focused             ? "#1e2a3a"
      : hovered             ? "#202020"
      :                       "transparent",
    color: active ? "#f0f0f0" : "#b4b4b4",
    transition: "background .1s, color .1s",
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: isDropTgt ? "1px dashed rgba(59,130,246,.5)"
      : focused ? "1px solid rgba(59,130,246,.3)" : "none",
    outlineOffset: "-1px",
    // P3 #4 — cut files are dimmed
    opacity: isDragging ? 0.5 : isCut ? 0.4 : 1,
  };

  const guides = Array.from({ length: depth }).map((_, i) => (
    <span key={i} style={{
      position: "absolute", left: 4 + i * INDENT + 5,
      top: 0, bottom: 0, width: 1,
      background: "#202020", pointerEvents: "none",
    }} />
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
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onMultiSelect(full, e);
    } else {
      setFocusedPath(full);
      onMultiSelect(full, e);
      if (!isDir) onSelect(full);
      else setOpen(v => !v);
    }
  };

  const badge = writing ? (
    <span className="rfe-badge"><span className="rfe-spinner" />{writeSize !== undefined ? formatBytes(writeSize) : "…"}</span>
  ) : activity ? (
    <AIActivityBadge activity={activity} />
  ) : ai ? (
    <AIActivityBadge activity="editing" />
  ) : dirty ? (
    <span title="Modified" style={{ fontSize: 9, padding: "0 3px", borderRadius: 2, background: "rgba(245,158,11,.15)", color: "#f59e0b", flexShrink: 0, letterSpacing: .2 }}>M</span>
  ) : gitSt ? (
    <GitStatusBadge status={gitSt} />
  ) : null;

  // P3 #8 — folder file count
  const folderCount = isDir ? folderCounts.get(full) : undefined;

  if (isDir) {
    return (
      <div>
        <div
          style={rowStyle} role="treeitem" aria-expanded={effectiveOpen} aria-selected={active}
          tabIndex={focused ? 0 : -1} data-tree-row="true" data-tree-path={full}
          data-tree-type="folder" data-tree-expanded={String(effectiveOpen)}
          onClick={handleClick}
          onContextMenu={(e) => onContextMenu(e, full, true)}
          onMouseEnter={() => { setHoveredPath(full); onHideMeta(); }}
          onMouseLeave={() => setHoveredPath(null)}
          data-testid={`folder-${node.name}`}
          {...dragHandlers}
        >
          {guides}
          <span style={{ color: "#4a4a4a", flexShrink: 0, display: "flex", zIndex: 1 }}>
            {effectiveOpen ? <ChevronDown style={{ width: 11, height: 11 }} /> : <ChevronRight style={{ width: 11, height: 11 }} />}
          </span>
          {fileIcon(node.name, "folder", effectiveOpen)}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: hovered || active ? "#d4d4d4" : "#9a9a9a" }}>
            {highlightName(node.name)}
          </span>
          {/* P3 #8 — folder file count */}
          {folderCount !== undefined && folderCount > 0 && (
            <span style={{ fontSize: 9, color: "#2e2e2e", marginLeft: 2, flexShrink: 0 }}>
              {folderCount}
            </span>
          )}
          {badge}
        </div>
        {effectiveOpen && (
          <div role="group">
            {Array.isArray(node.children) && node.children.map((child) => (
              <RenderNode key={child.name} node={child} basePath={full} depth={depth + 1}
                activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles}
                aiActivity={aiActivity} writingFiles={writingFiles} writingSizes={writingSizes}
                hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
                focusedPath={focusedPath} setFocusedPath={setFocusedPath}
                onSelect={onSelect} onContextMenu={onContextMenu} searchQuery={searchQuery}
                gitStatusMap={gitStatusMap} selectedPaths={selectedPaths} onMultiSelect={onMultiSelect}
                dragSourcePath={dragSourcePath} dropTargetPath={dropTargetPath}
                onDragStart={onDragStart} onDragEnter={onDragEnter}
                onDragEnd={onDragEnd} onDrop={onDrop}
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
    <div
      style={rowStyle} role="treeitem" aria-selected={active}
      tabIndex={focused ? 0 : -1} data-tree-row="true" data-tree-path={full}
      data-tree-type="file" data-tree-expanded="false"
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, full, false)}
      onMouseEnter={(e) => {
        setHoveredPath(full);
        // P3 #1/#2 — lazy file metadata fetch
        onShowMeta(full, e.clientX, e.clientY);
      }}
      onMouseLeave={() => { setHoveredPath(null); onHideMeta(); }}
      data-testid={`file-${node.name}`}
      {...dragHandlers}
    >
      {guides}
      <span style={{ width: 11, flexShrink: 0, zIndex: 1 }} />
      {fileIcon(node.name, "file")}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {highlightName(node.name)}
      </span>
      {badge}
    </div>
  );
}

// ── Inline creation row ────────────────────────────────────────────────────────
function InlineCreateRow({ type, onConfirm, onCancel }: { type: "file" | "folder"; onConfirm: (name: string) => void; onCancel: () => void }) {
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

export default function FileExplorer({ projectPath, onSelect, onFileSelect, activeFile }: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating]       = useState<"file" | "folder" | null>(null);
  const [width, setWidth]             = useState(loadWidth);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const lastSelectedPath = useRef<string | null>(null);
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  // P3 new state
  const [clipboard, setClipboard]     = useState<ClipboardState>(null);
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [metaTooltip, setMetaTooltip] = useState<(FileMeta & { path: string; x: number; y: number }) | null>(null);
  const metaCache   = useRef<Map<string, FileMeta>>(new Map());
  const metaTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadRef   = useRef<HTMLInputElement>(null);

  const searchRef     = useRef<HTMLInputElement>(null);
  const dragRef       = useRef<{ startX: number; startW: number } | null>(null);
  const handleRef     = useRef<HTMLDivElement>(null);
  const treeScrollRef = useRef<HTMLDivElement>(null);

  const selectHandler = onFileSelect ?? onSelect;

  const {
    tree, dirtyFiles, aiFiles, aiActivity, writingFiles, writingSizes, hoveredPath, focusedPath,
    setHoveredPath, setFocusedPath, refreshFiles, apiSaveFile,
    apiMovePath, apiDuplicatePath, handleRenamePath, handleDeletePath,
  } = useFileExplorer({ projectPath: projectPath ?? "", activeFile });

  const { statusMap: gitStatusMap } = useGitStatus();
  const { openFiles, openFile, closeFile, closeAll } = useOpenEditors();
  const { recentFiles, recordOpen } = useRecentFiles();
  // P3 #3 — pinned files
  const { pinnedFiles, pinFile, unpinFile, isPinned, clearPinned } = usePinnedFiles();

  // P3 multi-select
  const handleMultiSelect = useCallback((path: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path); else next.add(path);
        return next;
      });
    } else if (e.shiftKey && lastSelectedPath.current) {
      const rows = Array.from(treeScrollRef.current?.querySelectorAll("[data-tree-path]") ?? []);
      const paths = rows.map(el => el.getAttribute("data-tree-path")!).filter(Boolean);
      const a = paths.indexOf(lastSelectedPath.current);
      const b = paths.indexOf(path);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        setSelectedPaths(new Set(paths.slice(lo, hi + 1)));
      }
    } else {
      setSelectedPaths(new Set());
    }
    lastSelectedPath.current = path;
  }, []);

  // P2 drag & drop
  const handleDragStart = useCallback((path: string, _isDir: boolean) => setDragSourcePath(path), []);
  const handleDragEnter = useCallback((path: string) => setDropTargetPath(path), []);
  const handleDragEnd   = useCallback(() => { setDragSourcePath(null); setDropTargetPath(null); }, []);
  const handleDrop      = useCallback(async (sourcePath: string, targetPath: string) => {
    setDragSourcePath(null); setDropTargetPath(null);
    if (sourcePath === targetPath || targetPath.startsWith(sourcePath + "/")) return;
    try { await apiMovePath(sourcePath, targetPath); }
    catch (e) { console.error("[Explorer] Move failed:", e); }
  }, [apiMovePath]);

  // P3 #4 — copy / cut / paste
  const handleCopy  = useCallback((path: string) => setClipboard({ op: "copy", path }), []);
  const handleCut   = useCallback((path: string) => setClipboard({ op: "cut",  path }), []);
  const handlePaste = useCallback(async () => {
    if (!clipboard || !contextMenu) return;
    const targetDir = contextMenu.isDir
      ? contextMenu.path
      : contextMenu.path.replace(/\/[^/]+$/, "") || (projectPath ?? "");
    if (clipboard.op === "cut") {
      try { await apiMovePath(clipboard.path, targetDir); setClipboard(null); }
      catch (e) { console.error("[Explorer] Paste (cut) failed:", e); }
    } else {
      // copy — dispatch event for future backend; optimistic duplicate in same folder
      window.dispatchEvent(new CustomEvent("explorer:paste", {
        detail: { op: "copy", src: clipboard.path, dest: targetDir },
      }));
      await apiDuplicatePath(clipboard.path).catch(console.error);
    }
  }, [clipboard, contextMenu, projectPath, apiMovePath, apiDuplicatePath]);

  // P3 #1/#2 — lazy file metadata tooltip
  const handleShowMeta = useCallback((path: string, x: number, y: number) => {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      metaTimer.current = null;
      if (metaCache.current.has(path)) {
        const m = metaCache.current.get(path)!;
        setMetaTooltip({ path, ...m, x, y });
        return;
      }
      try {
        const r = await fetch(`/api/files/stat?path=${encodeURIComponent(path)}`);
        if (r.ok) {
          const d = await r.json();
          if (d.ok && d.size !== undefined) {
            const meta: FileMeta = { size: d.size, mtime: d.mtime };
            metaCache.current.set(path, meta);
            setMetaTooltip({ path, ...meta, x, y });
          }
        }
      } catch { /* ignore */ }
    }, 500);
  }, []);

  const handleHideMeta = useCallback(() => {
    if (metaTimer.current) { clearTimeout(metaTimer.current); metaTimer.current = null; }
    setMetaTooltip(null);
  }, []);

  // P3 #5 — folder upload
  const handleFolderUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const base = projectPath ?? "";
    await Promise.all(files.map(async (file) => {
      const rel  = (file as any).webkitRelativePath || file.name;
      const full = base ? `${base}/${rel}` : rel;
      try { await apiSaveFile(full, await file.text()); } catch {}
    }));
    refreshFiles();
    if (e.target) e.target.value = "";
  }, [projectPath, apiSaveFile, refreshFiles]);

  // P3 #8 — memoized folder file counts
  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    function walk(nodes: RawTreeNode[], basePath: string) {
      for (const n of nodes) {
        const full = basePath ? `${basePath}/${n.name}` : n.name;
        if ((n.type === "folder" || n.type === "directory") && n.children) {
          map.set(full, countDescendantFiles(n.children));
          walk(n.children, full);
        }
      }
    }
    walk(tree, projectPath || "");
    return map;
  }, [tree, projectPath]);

  // P3 #6 — search auto-expand: compute folder paths containing matches
  const searchExpandedPaths = useMemo(() => {
    const sq = searchQuery.trim().toLowerCase();
    if (!sq) return new Set<string>();
    const result = new Set<string>();
    collectSearchExpanded(tree, projectPath || "", sq, result);
    return result;
  }, [tree, searchQuery, projectPath]);

  // ── Sidebar resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = e.clientX - dragRef.current.startX;
      const next  = Math.min(MAX_W, Math.max(MIN_W, dragRef.current.startW + delta));
      setWidth(next);
    };
    const onUp = () => {
      if (!dragRef.current) return;
      try { localStorage.setItem(WIDTH_KEY, String(width)); } catch {}
      dragRef.current = null;
      handleRef.current?.classList.remove("dragging");
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [width]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    handleRef.current?.classList.add("dragging");
    document.body.style.cursor = "col-resize";
  };

  // P1 #4 / P3 #7 — Reveal + scroll active file; expand parents
  useEffect(() => {
    if (!activeFile || !projectPath) return;
    const relative = activeFile.startsWith(projectPath + "/")
      ? activeFile.slice(projectPath.length + 1) : activeFile;
    const parts = relative.split("/").filter(Boolean);
    let cur = projectPath;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur + "/" + parts[i];
      window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: cur, expanded: true } }));
    }
    const timer = setTimeout(() => {
      if (!treeScrollRef.current) return;
      const el = Array.from(treeScrollRef.current.querySelectorAll("[data-tree-row]"))
        .find(el => el.getAttribute("data-tree-path") === activeFile) as HTMLElement | undefined;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setFocusedPath(activeFile);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [activeFile, projectPath]);

  // P1 #2 — Keyboard navigation
  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    const container = treeScrollRef.current;
    if (!container) return;
    const rows = Array.from(container.querySelectorAll("[data-tree-row]")) as HTMLElement[];
    if (!rows.length) return;
    const curIdx = rows.findIndex(el => el.getAttribute("data-tree-path") === focusedPath);

    switch (e.key) {
      case "ArrowDown": { e.preventDefault(); const next = rows[Math.min(rows.length - 1, curIdx + 1)]; if (next) { setFocusedPath(next.getAttribute("data-tree-path")!); next.scrollIntoView({ block: "nearest" }); } break; }
      case "ArrowUp":   { e.preventDefault(); const prev = rows[Math.max(0, curIdx - 1)]; if (prev) { setFocusedPath(prev.getAttribute("data-tree-path")!); prev.scrollIntoView({ block: "nearest" }); } break; }
      case "ArrowRight":{ e.preventDefault(); const row = rows[curIdx]; if (row?.getAttribute("data-tree-type") === "folder" && row.getAttribute("data-tree-expanded") !== "true") window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: focusedPath, expanded: true } })); break; }
      case "ArrowLeft": { e.preventDefault(); const row = rows[curIdx]; if (row?.getAttribute("data-tree-type") === "folder" && row.getAttribute("data-tree-expanded") === "true") window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: focusedPath, expanded: false } })); break; }
      case "Enter": {
        e.preventDefault();
        if (!focusedPath) break;
        const row = rows[curIdx];
        if (row?.getAttribute("data-tree-type") === "folder") {
          const expanded = row.getAttribute("data-tree-expanded") === "true";
          window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: focusedPath, expanded: !expanded } }));
        } else { handleSelect(focusedPath); }
        break;
      }
      case " ":    { e.preventDefault(); if (focusedPath) setFocusedPath(focusedPath); break; }
      case "Home": { e.preventDefault(); const first = rows[0]; if (first) { setFocusedPath(first.getAttribute("data-tree-path")!); first.scrollIntoView({ block: "nearest" }); } break; }
      case "End":  { e.preventDefault(); const last = rows[rows.length - 1]; if (last) { setFocusedPath(last.getAttribute("data-tree-path")!); last.scrollIntoView({ block: "nearest" }); } break; }
    }
  };

  const handleSelect = (path: string) => {
    openFile(path);
    recordOpen(path);
    selectHandler?.(path);
  };

  const openCtx  = (e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, path, isDir });
  };
  const closeCtx = () => setContextMenu(null);

  const createFile = async (name: string) => {
    const base = contextMenu?.isDir === false
      ? contextMenu.path.replace(/\/[^/]+$/, "")
      : contextMenu?.path ?? projectPath ?? "";
    const full = (base ? base + "/" : (projectPath ? projectPath + "/" : "")) + name;
    try { await apiSaveFile(full, ""); refreshFiles(full); } catch {}
    setCreating(null);
  };

  const createFolder = async (name: string) => {
    const base = contextMenu?.path ?? projectPath ?? "";
    const full = (base ? base + "/" : "") + name + "/.keep";
    try { await apiSaveFile(full, ""); refreshFiles(full); } catch {}
    setCreating(null);
  };

  const { files: fileCount, folders: folderCount } = countTree(tree);
  const isEmpty       = tree.length === 0;
  const workspaceName = projectPath
    ? projectPath.split("/").filter(Boolean).pop() ?? "workspace" : "workspace";

  const hdrBtn = (Icon: React.ElementType, title: string, onClick: () => void) => (
    <button key={title} title={title} onClick={onClick}
      style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 3, color: "#3a3a3a", transition: "background .1s, color .1s", flexShrink: 0 }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#b4b4b4"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "#3a3a3a"; }}
    >
      <Icon style={{ width: 12, height: 12 }} />
    </button>
  );

  return (
    <div
      className="rfe-sidebar"
      style={{ width, display: "flex", flexDirection: "column", position: "relative", background: "#1c1c1c", borderRight: "1px solid #252525", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 12, height: "100%", flexShrink: 0 }}
      onClick={() => { if (contextMenu) closeCtx(); }}
    >
      {/* P3 #11 — hierarchy: Pinned → Open Editors → Recent → Files → Agents → Insights */}
      <PinnedFilesPanel
        files={pinnedFiles} activeFile={activeFile}
        onSelect={p => handleSelect(p)}
        onUnpin={unpinFile}
        onClearAll={clearPinned}
      />
      <OpenEditorsPanel files={openFiles} activeFile={activeFile} onSelect={p => selectHandler?.(p)} onClose={closeFile} onCloseAll={closeAll} />
      <RecentFilesPanel files={recentFiles} activeFile={activeFile} onSelect={p => handleSelect(p)} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 0 8px", height: 32, flexShrink: 0, borderBottom: "1px solid #252525" }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#4a4a4a", textTransform: "uppercase", letterSpacing: ".08em" }}>Files</span>
          {projectPath && (
            <span style={{ fontSize: 9, color: "#303030", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={projectPath}>
              {workspaceName} · {fileCount}f {folderCount}d
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
          {hdrBtn(FilePlus,   "New File",       () => setCreating("file"))}
          {hdrBtn(FolderPlus, "New Folder",     () => setCreating("folder"))}
          {/* P3 #5 — folder upload */}
          {hdrBtn(FolderUp,   "Upload Folder",  () => uploadRef.current?.click())}
          {hdrBtn(RotateCcw,  "Refresh",        () => refreshFiles())}
        </div>
        {/* Hidden folder input */}
        <input
          ref={uploadRef}
          type="file"
          // @ts-ignore — webkitdirectory is non-standard
          webkitdirectory=""
          multiple
          onChange={handleFolderUpload}
          style={{ display: "none" }}
        />
      </div>

      {/* Search */}
      <div style={{ padding: "4px 6px", flexShrink: 0, borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 6px", borderRadius: 4, background: "#141414", border: "1px solid #232323" }}>
          <Search style={{ width: 11, height: 11, color: "#363636", flexShrink: 0 }} />
          <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search files…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#c4c4c4", caretColor: "#3b82f6", fontFamily: "inherit" }}
            data-testid="input-explorer-search" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a3a", display: "flex", padding: 0 }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>
      </div>

      {/* Inline create row */}
      {creating && (
        <InlineCreateRow type={creating} onConfirm={creating === "file" ? createFile : createFolder} onCancel={() => setCreating(null)} />
      )}

      {/* P3 #7 — Tree / Empty state (scroll-to-active works via ref + useEffect above) */}
      <div
        ref={treeScrollRef} role="tree" aria-label="File explorer" tabIndex={0}
        style={{ flex: 1, overflowY: "auto", padding: "2px 0", outline: "none" }}
        onKeyDown={handleTreeKeyDown}
      >
        {isEmpty && !creating ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px 14px", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#202020", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderPlus style={{ width: 13, height: 13, color: "#3a3a3a" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#555", fontWeight: 500, marginBottom: 4 }}>No files yet</div>
              <div style={{ fontSize: 11, color: "#363636", lineHeight: 1.5 }}>Create a file or folder<br />to get started</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { label: "New file",   Icon: FilePlus,   onClick: () => setCreating("file") },
                { label: "New folder", Icon: FolderPlus, onClick: () => setCreating("folder") },
              ].map(({ label, Icon, onClick }) => (
                <button key={label} onClick={onClick}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 4, cursor: "pointer", background: "#222", border: "1px solid #2e2e2e", color: "#666", fontSize: 11, fontFamily: "inherit", transition: "all .1s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#b4b4b4"; el.style.borderColor = "#3a3a3a"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#222"; el.style.color = "#666"; el.style.borderColor = "#2e2e2e"; }}
                >
                  <Icon style={{ width: 11, height: 11 }} /> {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          tree.map((node) => (
            <RenderNode key={node.name} node={node} basePath={projectPath || ""} depth={0}
              activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles}
              aiActivity={aiActivity} writingFiles={writingFiles} writingSizes={writingSizes}
              hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
              focusedPath={focusedPath} setFocusedPath={setFocusedPath}
              onSelect={handleSelect} onContextMenu={openCtx} searchQuery={searchQuery}
              gitStatusMap={gitStatusMap} selectedPaths={selectedPaths} onMultiSelect={handleMultiSelect}
              dragSourcePath={dragSourcePath} dropTargetPath={dropTargetPath}
              onDragStart={handleDragStart} onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd} onDrop={handleDrop}
              folderCounts={folderCounts} forcedExpandedPaths={searchExpandedPaths}
              clipboard={clipboard} onShowMeta={handleShowMeta} onHideMeta={handleHideMeta}
            />
          ))
        )}
      </div>

      <AgentStatusPanel />

      {/* P3 #10 — Project Insights Panel */}
      <ProjectInsightsPanel
        tree={tree} aiFiles={aiFiles}
        writingFiles={writingFiles} dirtyFiles={dirtyFiles}
      />

      {/* P3 #1/#2 — File metadata tooltip */}
      {metaTooltip && (
        <div
          style={{
            position: "fixed",
            top: metaTooltip.y + 14,
            left: Math.min(metaTooltip.x + 10, window.innerWidth - 160),
            zIndex: 99999,
            background: "#151515",
            border: "1px solid #2a2a2a",
            borderRadius: 5,
            padding: "4px 8px",
            fontSize: 11,
            color: "#666",
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,.5)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: "#888" }}>{formatBytes(metaTooltip.size)}</span>
          <span style={{ color: "#333", margin: "0 5px" }}>·</span>
          <span>{timeAgo(metaTooltip.mtime)}</span>
        </div>
      )}

      {/* Context menu with P3 features */}
      <ContextMenu
        menu={contextMenu}
        targetPath={contextMenu?.path ?? ""}
        onNewFile={() => { closeCtx(); setCreating("file"); }}
        onNewFolder={() => { closeCtx(); setCreating("folder"); }}
        onRename={async () => { if (contextMenu) { await handleRenamePath(contextMenu.path); closeCtx(); } }}
        onDelete={async () => { if (contextMenu) { await handleDeletePath(contextMenu.path); closeCtx(); } }}
        onDuplicate={async () => { if (contextMenu) { await apiDuplicatePath(contextMenu.path); } }}
        onClose={closeCtx}
        onCopy={() => contextMenu && handleCopy(contextMenu.path)}
        onCut={() => contextMenu && handleCut(contextMenu.path)}
        onPaste={handlePaste}
        onPin={() => contextMenu && pinFile(contextMenu.path)}
        onUnpin={() => contextMenu && unpinFile(contextMenu.path)}
        onHistory={() => { if (contextMenu) { setHistoryFile(contextMenu.path); closeCtx(); } }}
        isPinned={contextMenu ? isPinned(contextMenu.path) : false}
        clipboard={clipboard}
      />

      {/* P3 #9 — File History modal */}
      {historyFile && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setHistoryFile(null)}
        >
          <div
            style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 10, padding: 20, width: 480, maxHeight: "70vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.8)" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#c4c4c4" }}>File History</div>
                <div style={{ fontSize: 11, color: "#484848", marginTop: 2 }}>{historyFile.split("/").pop()}</div>
              </div>
              <button
                onClick={() => setHistoryFile(null)}
                style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, lineHeight: 1, borderRadius: 4, padding: "2px 6px" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c4c4c4"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#555"; }}
              >
                ✕
              </button>
            </div>
            <FileHistoryPanel
              projectId={projectPath?.split("/").filter(Boolean).pop() ?? projectPath ?? ""}
              filePath={historyFile}
            />
          </div>
        </div>
      )}

      <div ref={handleRef} className="rfe-resize-handle" onMouseDown={startResize} data-testid="sidebar-resize-handle" />
    </div>
  );
}
