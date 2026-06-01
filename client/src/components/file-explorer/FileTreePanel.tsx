import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, X, FolderPlus, FilePlus } from "lucide-react";
import { RawTreeNode, ContextMenuState, ClipboardState, FileMeta } from "./types";
import { RenderNode, InlineCreateRow, countDescendantFiles, collectSearchExpanded, timeAgo } from "./TreeNode";
import type { RenderNodeProps } from "./TreeNode";
import { formatBytes } from "./use-file-explorer-utils";
import type { ActivityKind } from "./AIActivityBadge";
import type { GitStatus } from "./use-git-status";

type MenuAction = Parameters<RenderNodeProps["onRowMenuAction"]>[0];

export interface ExplorerTreeProps {
  tree: RawTreeNode[]; projectPath: string; activeFile?: string;
  dirtyFiles: Set<string>; aiFiles: Set<string>; aiActivity: Map<string, ActivityKind>;
  writingFiles: Set<string>; writingSizes: Map<string, number>;
  hoveredPath: string | null; setHoveredPath: (p: string | null) => void;
  focusedPath: string | null; setFocusedPath: (p: string | null) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
  gitStatusMap: Map<string, GitStatus>;
  creating: "file" | "folder" | null; setCreating: (v: "file" | "folder" | null) => void;
  onCreateFile: (name: string) => void; onCreateFolder: (name: string) => void;
  apiMovePath: (src: string, dest: string) => Promise<void>;
  apiDuplicatePath: (path: string) => Promise<void>;
  contextMenu: ContextMenuState;
  clipboard: ClipboardState;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
  onNewIn: (dir: string, type: "file" | "folder") => void;
}

export function ExplorerTree({
  tree, projectPath, activeFile, dirtyFiles, aiFiles, aiActivity, writingFiles, writingSizes,
  hoveredPath, setHoveredPath, focusedPath, setFocusedPath,
  onSelect, onContextMenu, gitStatusMap, creating, setCreating,
  onCreateFile, onCreateFolder, apiMovePath, contextMenu, clipboard,
  onRename, onDelete, onNewIn,
}: ExplorerTreeProps) {
  const [searchQuery, setSearchQuery]       = useState("");
  const [selectedPaths, setSelectedPaths]   = useState<Set<string>>(new Set());
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [metaTooltip, setMetaTooltip]       = useState<(FileMeta & { path: string; x: number; y: number }) | null>(null);
  const treeScrollRef   = useRef<HTMLDivElement>(null);
  const metaCache       = useRef<Map<string, FileMeta>>(new Map());
  const metaTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedRef = useRef<string | null>(null);

  const handleMultiSelect = useCallback((path: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedPaths(prev => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n; });
    } else if (e.shiftKey && lastSelectedRef.current) {
      const rows  = Array.from(treeScrollRef.current?.querySelectorAll("[data-tree-path]") ?? []);
      const paths = rows.map(el => el.getAttribute("data-tree-path")!).filter(Boolean);
      const a = paths.indexOf(lastSelectedRef.current), b = paths.indexOf(path);
      if (a !== -1 && b !== -1) { const [lo, hi] = a <= b ? [a, b] : [b, a]; setSelectedPaths(new Set(paths.slice(lo, hi + 1))); }
    } else { setSelectedPaths(new Set()); }
    lastSelectedRef.current = path;
  }, []);

  const handleDragStart = useCallback((path: string) => setDragSourcePath(path), []);
  const handleDragEnter = useCallback((path: string) => setDropTargetPath(path), []);
  const handleDragEnd   = useCallback(() => { setDragSourcePath(null); setDropTargetPath(null); }, []);
  const handleDrop      = useCallback(async (src: string, dest: string) => {
    setDragSourcePath(null); setDropTargetPath(null);
    if (src !== dest && !dest.startsWith(src + "/")) await apiMovePath(src, dest).catch(console.error);
  }, [apiMovePath]);

  const handleShowMeta = useCallback((path: string, x: number, y: number) => {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      metaTimer.current = null;
      if (metaCache.current.has(path)) { setMetaTooltip({ path, ...metaCache.current.get(path)!, x, y }); return; }
      try {
        const r = await fetch(`/api/files/stat?path=${encodeURIComponent(path)}`);
        if (r.ok) {
          const d = await r.json();
          if (d.ok && d.size !== undefined) {
            const m = { size: d.size, mtime: d.mtime };
            metaCache.current.set(path, m);
            setMetaTooltip({ path, ...m, x, y });
          }
        }
      } catch { /* ignore */ }
    }, 500);
  }, []);

  const handleHideMeta = useCallback(() => {
    if (metaTimer.current) { clearTimeout(metaTimer.current); metaTimer.current = null; }
    setMetaTooltip(null);
  }, []);

  const handleRowMenuAction = useCallback(async (action: MenuAction, path: string, isDir: boolean) => {
    switch (action) {
      case "rename":
        onRename(path);
        break;

      case "delete":
        onDelete(path);
        break;

      case "new-file":
        onNewIn(isDir ? path : path.replace(/\/[^/]+$/, "") || projectPath, "file");
        break;

      case "new-folder":
        onNewIn(isDir ? path : path.replace(/\/[^/]+$/, "") || projectPath, "folder");
        break;

      case "collapse": {
        const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-tree-type="folder"][data-tree-path]'));
        for (const row of rows) {
          const p = row.getAttribute("data-tree-path")!;
          if (p !== path && p.startsWith(path + "/")) {
            window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: p, expanded: false } }));
          }
        }
        break;
      }

      case "open-shell":
        window.dispatchEvent(new CustomEvent("terminal:cd", { detail: { path: isDir ? path : path.replace(/\/[^/]+$/, "") || projectPath } }));
        break;

      case "search-dir": {
        const dir = isDir ? path : path.replace(/\/[^/]+$/, "") || projectPath;
        setSearchQuery(dir.split("/").pop() ?? "");
        window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: dir, expanded: true } }));
        setTimeout(() => {
          const el = treeScrollRef.current?.querySelector(`[data-tree-path="${dir}"]`) as HTMLElement | null;
          if (el) { el.scrollIntoView({ block: "nearest" }); setFocusedPath(dir); }
        }, 60);
        break;
      }

      case "copy-path":
        try { await navigator.clipboard.writeText(path); } catch { /* ignore */ }
        break;

      case "copy-link":
        try { await navigator.clipboard.writeText(`${window.location.origin}/${path}`); } catch { /* ignore */ }
        break;

      case "download": {
        if (isDir) {
          window.open(`/api/file-explorer/download?projectPath=${encodeURIComponent(path)}`, "_blank");
        } else {
          try {
            const res  = await fetch(`/api/read-file?filePath=${encodeURIComponent(path)}`);
            const data = await res.json();
            if (data.content !== undefined) {
              const blob = new Blob([data.content], { type: "text/plain" });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement("a");
              a.href = url; a.download = path.split("/").pop() ?? "file"; a.click();
              URL.revokeObjectURL(url);
            }
          } catch { /* ignore */ }
        }
        break;
      }
    }
  }, [onRename, onDelete, onNewIn, projectPath, setFocusedPath]);

  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    const walk = (nodes: RawTreeNode[], base: string) => {
      for (const n of nodes) {
        const full = base ? `${base}/${n.name}` : n.name;
        if ((n.type === "folder" || n.type === "directory") && n.children) { map.set(full, countDescendantFiles(n.children)); walk(n.children, full); }
      }
    };
    walk(tree, projectPath);
    return map;
  }, [tree, projectPath]);

  const searchExpandedPaths = useMemo(() => {
    const sq = searchQuery.trim().toLowerCase();
    if (!sq) return new Set<string>();
    const result = new Set<string>();
    collectSearchExpanded(tree, projectPath, sq, result);
    return result;
  }, [tree, searchQuery, projectPath]);

  useEffect(() => {
    if (!activeFile || !projectPath) return;
    const relative = activeFile.startsWith(projectPath + "/") ? activeFile.slice(projectPath.length + 1) : activeFile;
    let cur = projectPath;
    for (const part of relative.split("/").filter(Boolean).slice(0, -1)) {
      cur = cur + "/" + part;
      window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: cur, expanded: true } }));
    }
    const timer = setTimeout(() => {
      const el = Array.from(treeScrollRef.current?.querySelectorAll("[data-tree-row]") ?? []).find(el => el.getAttribute("data-tree-path") === activeFile) as HTMLElement | undefined;
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); setFocusedPath(activeFile); }
    }, 80);
    return () => clearTimeout(timer);
  }, [activeFile, projectPath]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const rows = Array.from(treeScrollRef.current?.querySelectorAll("[data-tree-row]") ?? []) as HTMLElement[];
    if (!rows.length) return;
    const idx = rows.findIndex(el => el.getAttribute("data-tree-path") === focusedPath);
    const go  = (el: HTMLElement | undefined) => { if (el) { setFocusedPath(el.getAttribute("data-tree-path")!); el.scrollIntoView({ block: "nearest" }); } };
    const dispatch = (expanded: boolean) => window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: focusedPath, expanded } }));
    switch (e.key) {
      case "ArrowDown":  e.preventDefault(); go(rows[Math.min(rows.length - 1, idx + 1)]); break;
      case "ArrowUp":    e.preventDefault(); go(rows[Math.max(0, idx - 1)]); break;
      case "ArrowRight": e.preventDefault(); if (rows[idx]?.getAttribute("data-tree-type") === "folder" && rows[idx]?.getAttribute("data-tree-expanded") !== "true") dispatch(true); break;
      case "ArrowLeft":  e.preventDefault(); if (rows[idx]?.getAttribute("data-tree-type") === "folder" && rows[idx]?.getAttribute("data-tree-expanded") === "true") dispatch(false); break;
      case "Enter": e.preventDefault(); if (focusedPath) { if (rows[idx]?.getAttribute("data-tree-type") === "folder") dispatch(rows[idx]?.getAttribute("data-tree-expanded") !== "true"); else onSelect(focusedPath); } break;
      case "Home": e.preventDefault(); go(rows[0]); break;
      case "End":  e.preventDefault(); go(rows[rows.length - 1]); break;
    }
  };

  const sq = searchQuery.trim().toLowerCase();

  // Clamp tooltip so it never clips at the bottom of the viewport
  const tipY = metaTooltip
    ? Math.min(metaTooltip.y + 14, window.innerHeight - 52)
    : 0;
  const tipX = metaTooltip
    ? Math.min(metaTooltip.x + 10, window.innerWidth - 170)
    : 0;

  return (
    <>
      {/* ── Search bar ── */}
      <div style={{ padding: "4px 6px", flexShrink: 0, borderBottom: "1px solid #1e1e1e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 6px", borderRadius: 4, background: "#141414", border: "1px solid #232323" }}>
          <Search style={{ width: 11, height: 11, color: "#484848", flexShrink: 0 }} />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search files…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#c4c4c4", caretColor: "#3b82f6", fontFamily: "inherit", minWidth: 0 }}
            data-testid="input-explorer-search" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#484848", display: "flex", padding: 0, flexShrink: 0 }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>
      </div>

      {creating && <InlineCreateRow type={creating} onConfirm={creating === "file" ? onCreateFile : onCreateFolder} onCancel={() => setCreating(null)} />}

      {/* ── Tree scroll area ── */}
      <div ref={treeScrollRef} role="tree" aria-label="File explorer" tabIndex={0}
        style={{ flex: 1, overflowY: "auto", padding: "2px 0", outline: "none" }} onKeyDown={handleKeyDown}>
        {tree.length === 0 && !creating ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px 14px", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#202020", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderPlus style={{ width: 13, height: 13, color: "#4a4a4a" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#666", fontWeight: 500, marginBottom: 4 }}>No files yet</div>
              <div style={{ fontSize: 11, color: "#484848", lineHeight: 1.5 }}>Create a file or folder<br />to get started</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([{ label: "New file", Icon: FilePlus, t: "file" }, { label: "New folder", Icon: FolderPlus, t: "folder" }] as const).map(({ label, Icon, t }) => (
                <button key={label} onClick={() => setCreating(t)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 4, cursor: "pointer", background: "#222", border: "1px solid #2e2e2e", color: "#666", fontSize: 11, fontFamily: "inherit", transition: "all .1s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#b4b4b4"; el.style.borderColor = "#3a3a3a"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#222"; el.style.color = "#666"; el.style.borderColor = "#2e2e2e"; }}
                ><Icon style={{ width: 11, height: 11 }} /> {label}</button>
              ))}
            </div>
          </div>
        ) : (
          tree.map(node => (
            <RenderNode key={node.name} node={node} basePath={projectPath} depth={0}
              activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles} aiActivity={aiActivity}
              writingFiles={writingFiles} writingSizes={writingSizes}
              hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
              focusedPath={focusedPath} setFocusedPath={setFocusedPath}
              onSelect={onSelect} onContextMenu={onContextMenu} searchQuery={sq}
              gitStatusMap={gitStatusMap} selectedPaths={selectedPaths} onMultiSelect={handleMultiSelect}
              dragSourcePath={dragSourcePath} dropTargetPath={dropTargetPath}
              onDragStart={handleDragStart} onDragEnter={handleDragEnter} onDragEnd={handleDragEnd} onDrop={handleDrop}
              folderCounts={folderCounts} forcedExpandedPaths={searchExpandedPaths}
              clipboard={clipboard} onShowMeta={handleShowMeta} onHideMeta={handleHideMeta}
              onRowMenuAction={handleRowMenuAction}
            />
          ))
        )}
      </div>

      {/* ── File meta tooltip — viewport-clamped ── */}
      {metaTooltip && (
        <div style={{
          position: "fixed", top: tipY, left: tipX, zIndex: 9999,
          background: "#151515", border: "1px solid #2a2a2a", borderRadius: 5,
          padding: "4px 8px", fontSize: 11, color: "#666",
          pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,.5)", whiteSpace: "nowrap",
        }}>
          <span style={{ color: "#888" }}>{formatBytes(metaTooltip.size)}</span>
          <span style={{ color: "#333", margin: "0 5px" }}>·</span>
          <span>{timeAgo(metaTooltip.mtime)}</span>
        </div>
      )}
    </>
  );
}


interface FileTreePanelProps {
  onFileOpen: (name: string, content: string, lang: string) => void;
  onClose: () => void;
  activeFileName?: string;
}

export function FileTreePanel({ onClose }: FileTreePanelProps) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#1c1c1c", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px", height: 36, flexShrink: 0, borderBottom: "1px solid #252525" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".08em" }}>Explorer</span>
        <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, lineHeight: 1, borderRadius: 3, padding: "2px 5px", fontFamily: "inherit" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c4c4c4"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#555"; }}>✕</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#484848" }}>Use the main file explorer in the sidebar</span>
      </div>
    </div>
  );
}
