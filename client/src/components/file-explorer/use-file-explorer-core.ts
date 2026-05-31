import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { RawTreeNode, ContextMenuState, ClipboardState, FileMeta } from "./types";
import { countDescendantFiles, collectSearchExpanded } from "./RenderNode";
import { useFileExplorer } from "./use-file-explorer";
import { useGitStatus } from "./use-git-status";
import { useOpenEditors } from "./use-open-editors";
import { useRecentFiles } from "./use-recent-files";
import { usePinnedFiles } from "./use-pinned-files";

const MIN_W     = 160;
const MAX_W     = 480;
const WIDTH_KEY = "rfe_sidebar_width";

const loadWidth = () => {
  try { const s = localStorage.getItem(WIDTH_KEY); return s ? Math.min(MAX_W, Math.max(MIN_W, parseInt(s, 10))) : 220; }
  catch { return 220; }
};

interface CoreProps {
  projectPath?: string;
  onSelect?: (path: string) => void;
  onFileSelect?: (path: string) => void;
  activeFile?: string;
}

export function useFileExplorerCore({ projectPath, onSelect, onFileSelect, activeFile }: CoreProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating]       = useState<"file" | "folder" | null>(null);
  const [width, setWidth]             = useState(loadWidth);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [clipboard, setClipboard]     = useState<ClipboardState>(null);
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [metaTooltip, setMetaTooltip] = useState<(FileMeta & { path: string; x: number; y: number }) | null>(null);

  const lastSelectedPath = useRef<string | null>(null);
  const metaCache        = useRef<Map<string, FileMeta>>(new Map());
  const metaTimer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadRef        = useRef<HTMLInputElement>(null);
  const searchRef        = useRef<HTMLInputElement>(null);
  const dragRef          = useRef<{ startX: number; startW: number } | null>(null);
  const handleRef        = useRef<HTMLDivElement>(null);
  const treeScrollRef    = useRef<HTMLDivElement>(null);

  const selectHandler = onFileSelect ?? onSelect;

  const {
    tree, dirtyFiles, aiFiles, aiActivity, writingFiles, writingSizes,
    hoveredPath, focusedPath, setHoveredPath, setFocusedPath,
    refreshFiles, apiSaveFile, apiMovePath, apiDuplicatePath,
    handleRenamePath, handleDeletePath,
  } = useFileExplorer({ projectPath: projectPath ?? "", activeFile });

  const { statusMap: gitStatusMap }                        = useGitStatus();
  const { openFiles, openFile, closeFile, closeAll }       = useOpenEditors();
  const { recentFiles, recordOpen }                        = useRecentFiles();
  const { pinnedFiles, pinFile, unpinFile, isPinned, clearPinned } = usePinnedFiles();

  const handleMultiSelect = useCallback((path: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path); else next.add(path);
        return next;
      });
    } else if (e.shiftKey && lastSelectedPath.current) {
      const rows  = Array.from(treeScrollRef.current?.querySelectorAll("[data-tree-path]") ?? []);
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

  const handleDragStart = useCallback((path: string, _isDir: boolean) => setDragSourcePath(path), []);
  const handleDragEnter = useCallback((path: string) => setDropTargetPath(path), []);
  const handleDragEnd   = useCallback(() => { setDragSourcePath(null); setDropTargetPath(null); }, []);
  const handleDrop      = useCallback(async (sourcePath: string, targetPath: string) => {
    setDragSourcePath(null); setDropTargetPath(null);
    if (sourcePath === targetPath || targetPath.startsWith(sourcePath + "/")) return;
    try { await apiMovePath(sourcePath, targetPath); }
    catch (e) { console.error("[Explorer] Move failed:", e); }
  }, [apiMovePath]);

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
      window.dispatchEvent(new CustomEvent("explorer:paste", { detail: { op: "copy", src: clipboard.path, dest: targetDir } }));
      await apiDuplicatePath(clipboard.path).catch(console.error);
    }
  }, [clipboard, contextMenu, projectPath, apiMovePath, apiDuplicatePath]);

  const handleShowMeta = useCallback((path: string, x: number, y: number) => {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      metaTimer.current = null;
      if (metaCache.current.has(path)) {
        const m = metaCache.current.get(path)!;
        setMetaTooltip({ path, ...m, x, y }); return;
      }
      try {
        const r = await fetch(`/api/files/stat?path=${encodeURIComponent(path)}`);
        if (r.ok) {
          const d = await r.json();
          if (d.ok && d.size !== undefined) {
            const meta: FileMeta = { size: d.size, mtime: d.mtime };
            metaCache.current.set(path, meta); setMetaTooltip({ path, ...meta, x, y });
          }
        }
      } catch { /* ignore */ }
    }, 500);
  }, []);

  const handleHideMeta = useCallback(() => {
    if (metaTimer.current) { clearTimeout(metaTimer.current); metaTimer.current = null; }
    setMetaTooltip(null);
  }, []);

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

  const searchExpandedPaths = useMemo(() => {
    const sq = searchQuery.trim().toLowerCase();
    if (!sq) return new Set<string>();
    const result = new Set<string>();
    collectSearchExpanded(tree, projectPath || "", sq, result);
    return result;
  }, [tree, searchQuery, projectPath]);

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
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); setFocusedPath(activeFile); }
    }, 80);
    return () => clearTimeout(timer);
  }, [activeFile, projectPath]);

  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    const container = treeScrollRef.current;
    if (!container) return;
    const rows  = Array.from(container.querySelectorAll("[data-tree-row]")) as HTMLElement[];
    if (!rows.length) return;
    const curPath = focusedPath;
    const curIdx  = rows.findIndex(el => el.getAttribute("data-tree-path") === curPath);
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
      case "Home": { e.preventDefault(); const first = rows[0]; if (first) { setFocusedPath(first.getAttribute("data-tree-path")!); first.scrollIntoView({ block: "nearest" }); } break; }
      case "End":  { e.preventDefault(); const last = rows[rows.length - 1]; if (last) { setFocusedPath(last.getAttribute("data-tree-path")!); last.scrollIntoView({ block: "nearest" }); } break; }
    }
  };

  const handleSelect = (path: string) => {
    openFile(path); recordOpen(path); selectHandler?.(path);
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

  return {
    tree, dirtyFiles, aiFiles, aiActivity, writingFiles, writingSizes,
    hoveredPath, focusedPath, setHoveredPath, setFocusedPath,
    refreshFiles, apiSaveFile, apiMovePath, apiDuplicatePath,
    handleRenamePath, handleDeletePath,
    gitStatusMap, openFiles, openFile, closeFile, closeAll,
    recentFiles, recordOpen, pinnedFiles, pinFile, unpinFile, isPinned, clearPinned,
    contextMenu, setContextMenu, searchQuery, setSearchQuery,
    creating, setCreating, width, selectedPaths, dragSourcePath, dropTargetPath,
    clipboard, historyFile, setHistoryFile, metaTooltip,
    uploadRef, searchRef, handleRef, treeScrollRef,
    selectHandler,
    handleMultiSelect, handleDragStart, handleDragEnter, handleDragEnd, handleDrop,
    handleCopy, handleCut, handlePaste,
    handleShowMeta, handleHideMeta, handleFolderUpload,
    folderCounts, searchExpandedPaths,
    startResize, handleTreeKeyDown, handleSelect, openCtx, closeCtx,
    createFile, createFolder,
  };
}
