import { useState, useEffect, useRef, useCallback } from "react";
import { FilePlus, FolderPlus, RotateCcw, FolderUp } from "lucide-react";
import { ContextMenuState, ClipboardState } from "./types";
import { useFileExplorer } from "./use-file-explorer";
import { countTree, formatBytes } from "./use-file-explorer-utils";
import { usePinnedFiles } from "./use-pinned-files";
import { PinnedFilesPanel } from "./PinnedFilesPanel";
import { AgentStatusPanel } from "./AgentStatusPanel";
import { ProjectInsightsPanel } from "./ProjectInsightsPanel";
import { ContextMenu } from "./ContextMenu";
import { useGitStatus } from "./use-git-status";
import FileHistoryPanel from "./FileHistoryPanel";
import { ExplorerTree } from "./FileTreePanel";

export { countTree, formatBytes } from "./use-file-explorer-utils";

interface FileExplorerProps {
  projectPath?: string;
  onSelect?:    (path: string) => void;
  onFileSelect?:(path: string) => void;
  activeFile?:  string;
}

const MIN_W = 160, MAX_W = 480, WIDTH_KEY = "rfe_sidebar_width";
const loadWidth = () => { try { const s = localStorage.getItem(WIDTH_KEY); return s ? Math.min(MAX_W, Math.max(MIN_W, parseInt(s, 10))) : 220; } catch { return 220; } };

export default function FileExplorer({ projectPath, onSelect, onFileSelect, activeFile }: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [creating, setCreating]       = useState<"file" | "folder" | null>(null);
  const [width, setWidth]             = useState(loadWidth);
  const [historyFile, setHistoryFile] = useState<string | null>(null);
  const [clipboard, setClipboard]     = useState<ClipboardState>(null);

  const dragRef        = useRef<{ startX: number; startW: number } | null>(null);
  const handleRef      = useRef<HTMLDivElement>(null);
  const uploadRef      = useRef<HTMLInputElement>(null);
  const creatingInDir  = useRef<string | null>(null);

  const selectHandler = onFileSelect ?? onSelect;

  const {
    tree, dirtyFiles, aiFiles, aiActivity, writingFiles, writingSizes, hoveredPath, focusedPath,
    setHoveredPath, setFocusedPath, refreshFiles, apiSaveFile, apiMovePath, apiDuplicatePath,
    handleRenamePath, handleDeletePath,
  } = useFileExplorer({ projectPath: projectPath ?? "", activeFile });

  const { statusMap: gitStatusMap } = useGitStatus();
  const { pinnedFiles, pinFile, unpinFile, isPinned, clearPinned } = usePinnedFiles();

  const handleSelect = (path: string) => { selectHandler?.(path); };
  const openCtx      = (e: React.MouseEvent, path: string, isDir: boolean) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, path, isDir }); };
  const closeCtx     = () => setContextMenu(null);

  // ── Clipboard handlers ────────────────────────────────────────────────────
  const handleCopyFile = useCallback((path: string) => setClipboard({ op: "copy", path }), []);
  const handleCutFile  = useCallback((path: string) => setClipboard({ op: "cut",  path }), []);

  const handlePaste = useCallback(async () => {
    if (!clipboard || !contextMenu) return;
    const dir = contextMenu.isDir
      ? contextMenu.path
      : contextMenu.path.replace(/\/[^/]+$/, "") || projectPath || "";

    if (clipboard.op === "cut") {
      await apiMovePath(clipboard.path, dir).catch(console.error);
      setClipboard(null);
    } else {
      const fileName = clipboard.path.split("/").pop()!;
      const destPath = dir ? `${dir}/${fileName}` : fileName;
      try {
        const res = await fetch("/api/duplicate-file", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourcePath: clipboard.path, destPath }),
        });
        if (!res.ok) {
          console.error("[file-explorer] Paste copy failed:", await res.text());
        }
      } catch (e) {
        console.error("[file-explorer] Paste copy error:", e);
      }
      window.dispatchEvent(new Event("file-refresh"));
    }
  }, [clipboard, contextMenu, projectPath, apiMovePath]);

  // ── File creation ─────────────────────────────────────────────────────────
  const createFile = async (name: string) => {
    const base = creatingInDir.current
      ?? (contextMenu?.isDir === false ? contextMenu.path.replace(/\/[^/]+$/, "") : contextMenu?.path)
      ?? projectPath ?? "";
    const full = (base ? base + "/" : (projectPath ? projectPath + "/" : "")) + name;
    try { await apiSaveFile(full, ""); refreshFiles(full); } catch {}
    setCreating(null);
    creatingInDir.current = null;
  };

  const createFolder = async (name: string) => {
    const base = creatingInDir.current ?? contextMenu?.path ?? projectPath ?? "";
    try { await apiSaveFile((base ? base + "/" : "") + name + "/.keep", ""); refreshFiles(); } catch {}
    setCreating(null);
    creatingInDir.current = null;
  };

  const handleNewIn = useCallback((dir: string, type: "file" | "folder") => {
    creatingInDir.current = dir;
    setCreating(type);
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

  // ── Resize handle ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const next = Math.min(MAX_W, Math.max(MIN_W, dragRef.current.startW + (e.clientX - dragRef.current.startX)));
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

  const hdrBtn = (Icon: React.ElementType, title: string, onClick: () => void) => (
    <button key={title} title={title} onClick={onClick}
      style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: "pointer", borderRadius: 3, color: "#606060", transition: "background .1s, color .1s", flexShrink: 0 }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#c4c4c4"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "#606060"; }}
    ><Icon style={{ width: 12, height: 12 }} /></button>
  );

  return (
    <div className="rfe-sidebar" style={{ width, display: "flex", flexDirection: "column", position: "relative", background: "#1c1c1c", borderRight: "1px solid #252525", fontFamily: "'Inter', system-ui, -apple-system, sans-serif", fontSize: 12, height: "100%", flexShrink: 0 }}
      onClick={() => { if (contextMenu) closeCtx(); }}>

      <PinnedFilesPanel files={pinnedFiles} activeFile={activeFile} onSelect={handleSelect} onUnpin={unpinFile} onClearAll={clearPinned} />

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 4px", height: 32, flexShrink: 0, borderBottom: "1px solid #252525" }}>
        <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
          {hdrBtn(FilePlus,   "New File",       () => setCreating("file"))}
          {hdrBtn(FolderPlus, "New Folder",     () => setCreating("folder"))}
          {hdrBtn(FolderUp,   "Upload Folder",  () => uploadRef.current?.click())}
          {hdrBtn(RotateCcw,  "Refresh",        () => refreshFiles())}
        </div>
        <input ref={uploadRef} type="file" multiple onChange={handleFolderUpload} style={{ display: "none" }} {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)} />
      </div>

      <ExplorerTree
        tree={tree} projectPath={projectPath ?? ""} activeFile={activeFile}
        dirtyFiles={dirtyFiles} aiFiles={aiFiles} aiActivity={aiActivity}
        writingFiles={writingFiles} writingSizes={writingSizes}
        hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
        focusedPath={focusedPath} setFocusedPath={setFocusedPath}
        onSelect={handleSelect} onContextMenu={openCtx} gitStatusMap={gitStatusMap}
        creating={creating} setCreating={setCreating}
        onCreateFile={createFile} onCreateFolder={createFolder}
        apiMovePath={apiMovePath} apiDuplicatePath={apiDuplicatePath}
        contextMenu={contextMenu}
        clipboard={clipboard}
        onRename={path => { handleRenamePath(path); }}
        onDelete={path => { handleDeletePath(path); }}
        onNewIn={handleNewIn}
      />

      <AgentStatusPanel />
      <ProjectInsightsPanel tree={tree} aiFiles={aiFiles} writingFiles={writingFiles} dirtyFiles={dirtyFiles} />

      {/* ── Context Menu ── */}
      <ContextMenu
        menu={contextMenu} targetPath={contextMenu?.path ?? ""}
        onNewFile={() => { closeCtx(); setCreating("file"); }}
        onNewFolder={() => { closeCtx(); setCreating("folder"); }}
        onRename={async () => { if (contextMenu) { await handleRenamePath(contextMenu.path); closeCtx(); } }}
        onDelete={async () => { if (contextMenu) { await handleDeletePath(contextMenu.path); closeCtx(); } }}
        onDuplicate={async () => { if (contextMenu) { await apiDuplicatePath(contextMenu.path); closeCtx(); } }}
        onClose={closeCtx}
        onCopy={() => { if (contextMenu) { handleCopyFile(contextMenu.path); closeCtx(); } }}
        onCut={() => { if (contextMenu) { handleCutFile(contextMenu.path); closeCtx(); } }}
        onPaste={async () => { await handlePaste(); closeCtx(); }}
        onPin={() => contextMenu && pinFile(contextMenu.path)}
        onUnpin={() => contextMenu && unpinFile(contextMenu.path)}
        onHistory={() => { if (contextMenu) { setHistoryFile(contextMenu.path); closeCtx(); } }}
        isPinned={contextMenu ? isPinned(contextMenu.path) : false}
        clipboard={clipboard}
      />

      {/* ── File History Modal ── */}
      {historyFile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setHistoryFile(null)}>
          <div style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 10, padding: 20, width: 480, maxHeight: "70vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.8)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#c4c4c4" }}>File History</div>
                <div style={{ fontSize: 11, color: "#585858", marginTop: 2 }}>{historyFile.split("/").pop()}</div>
              </div>
              <button onClick={() => setHistoryFile(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, lineHeight: 1, borderRadius: 4, padding: "2px 6px" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#c4c4c4"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#555"; }}>✕</button>
            </div>
            <FileHistoryPanel projectId={projectPath?.split("/").filter(Boolean).pop() ?? projectPath ?? ""} filePath={historyFile} />
          </div>
        </div>
      )}

      <div ref={handleRef} className="rfe-resize-handle" onMouseDown={startResize} data-testid="sidebar-resize-handle" />
    </div>
  );
}
