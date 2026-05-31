import { RawTreeNode } from "./types";
import { fileIcon } from "./file-icon";
import { ContextMenu } from "./ContextMenu";
import { useFileExplorer } from "./use-file-explorer";
import { useOpenEditors } from "./use-open-editors";
import { useRecentFiles } from "./use-recent-files";
import { OpenEditorsPanel } from "./OpenEditorsPanel";
import { RecentFilesPanel } from "./RecentFilesPanel";
import { AgentStatusPanel } from "./AgentStatusPanel";
import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, FilePlus, FolderPlus, RotateCcw, Search, X } from "lucide-react";
import { InlineInput } from "./InlineInput";

// ── Sidebar resize constants ───────────────────────────────────────────────────
const WIDTH_KEY = "nura-x:explorer-width";
const MIN_W     = 160;
const MAX_W     = 480;
const DEF_W     = 220;

function loadWidth(): number {
  try { return Math.min(MAX_W, Math.max(MIN_W, Number(localStorage.getItem(WIDTH_KEY)) || DEF_W)); }
  catch { return DEF_W; }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

function countTree(nodes: RawTreeNode[]): { files: number; folders: number } {
  let files = 0, folders = 0;
  for (const n of nodes) {
    if (n.type === "file") { files++; }
    else { folders++; if (n.children) { const c = countTree(n.children); files += c.files; folders += c.folders; } }
  }
  return { files, folders };
}

// Inject animations once
if (typeof document !== "undefined" && !document.getElementById("__rfe-anim__")) {
  const s = document.createElement("style");
  s.id    = "__rfe-anim__";
  s.textContent = `
    @keyframes rfe-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes rfe-spin  { to{transform:rotate(360deg)} }
    .rfe-spinner { width:6px;height:6px;border:1.5px solid rgba(59,130,246,.3);border-top-color:#60a5fa;border-radius:50%;animation:rfe-spin .7s linear infinite; }
    .rfe-badge { display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(59,130,246,.15);color:#93c5fd;animation:rfe-pulse 1.2s ease infinite;white-space:nowrap; }
    .rfe-sidebar ::-webkit-scrollbar{width:3px}
    .rfe-sidebar ::-webkit-scrollbar-track{background:transparent}
    .rfe-sidebar ::-webkit-scrollbar-thumb{background:#2e2e2e;border-radius:2px}
    .rfe-sidebar ::-webkit-scrollbar-thumb:hover{background:#3a3a3a}
    .rfe-resize-handle { width:4px;cursor:col-resize;position:absolute;top:0;right:0;bottom:0;z-index:10;background:transparent;transition:background .15s; }
    .rfe-resize-handle:hover,.rfe-resize-handle.dragging { background:rgba(59,130,246,.35); }
  `;
  document.head.appendChild(s);
}

interface FileExplorerProps {
  projectPath:    string;
  onSelect?:      (path: string) => void;
  onFileSelect?:  (path: string) => void;
  activeFile?:    string;
}

const INDENT = 14;

// ── RenderNode ────────────────────────────────────────────────────────────────
function RenderNode({
  node, basePath, depth, activeFile, dirtyFiles, aiFiles,
  writingFiles, writingSizes, hoveredPath, setHoveredPath,
  setFocusedPath, focusedPath, onSelect, onContextMenu, searchQuery,
}: {
  node: RawTreeNode; basePath: string; depth: number;
  activeFile?: string; dirtyFiles: Set<string>; aiFiles: Set<string>;
  writingFiles: Set<string>; writingSizes: Map<string, number>;
  hoveredPath: string | null; focusedPath: string | null;
  setHoveredPath: (p: string | null) => void;
  setFocusedPath: (p: string | null) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
  searchQuery: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isDir     = node.type === "folder" || node.type === "directory";
  const full      = (basePath && basePath !== "/" ? basePath + "/" : "") + node.name;
  const active    = !!activeFile && activeFile === full;
  const focused   = focusedPath === full;
  const dirty     = dirtyFiles.has(full);
  const ai        = aiFiles.has(full);
  const writing   = writingFiles.has(full);
  const writeSize = writingSizes.get(full);
  const hovered   = hoveredPath === full;

  // P1 #4 — keyboard expand/collapse via custom event (dispatched by keyboard handler)
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
    cursor: "pointer", userSelect: "none", fontSize: 12,
    position: "relative",
    borderLeft: active   ? "2px solid #3b82f6"
      : writing          ? "2px solid #60a5fa"
      : dirty            ? "2px solid #f59e0b"
      :                    "2px solid transparent",
    background: writing ? "rgba(59,130,246,.06)"
      : active  ? "#2a2a2a"
      : focused ? "#1e2a3a"
      : hovered ? "#202020"
      : "transparent",
    color: active ? "#f0f0f0" : "#b4b4b4",
    transition: "background .1s, color .1s",
    fontFamily: "'Inter', system-ui, sans-serif",
    outline: focused ? "1px solid rgba(59,130,246,.3)" : "none",
    outlineOffset: "-1px",
  };

  if (isDir) {
    return (
      <div>
        <div
          style={rowStyle}
          role="treeitem"
          aria-expanded={open}
          aria-selected={active}
          tabIndex={focused ? 0 : -1}
          data-tree-row="true"
          data-tree-path={full}
          data-tree-type="folder"
          data-tree-expanded={String(open)}
          onClick={() => { setFocusedPath(full); setOpen(v => !v); onSelect(full); }}
          onContextMenu={(e) => onContextMenu(e, full, true)}
          onMouseEnter={() => setHoveredPath(full)}
          onMouseLeave={() => setHoveredPath(null)}
          data-testid={`folder-${node.name}`}
        >
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} style={{
              position: "absolute", left: 4 + i * INDENT + 5,
              top: 0, bottom: 0, width: 1,
              background: "#202020", pointerEvents: "none",
            }} />
          ))}
          <span style={{ color: "#4a4a4a", flexShrink: 0, display: "flex", zIndex: 1 }}>
            {open
              ? <ChevronDown  style={{ width: 11, height: 11 }} />
              : <ChevronRight style={{ width: 11, height: 11 }} />}
          </span>
          {fileIcon(node.name, "folder", open)}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: hovered || active ? "#d4d4d4" : "#9a9a9a" }}>
            {highlightName(node.name)}
          </span>
          {writing ? (
            <span className="rfe-badge"><span className="rfe-spinner" />{writeSize !== undefined ? formatBytes(writeSize) : "…"}</span>
          ) : ai ? (
            <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "rgba(34,197,94,.15)", color: "#4ade80", letterSpacing: .3 }}>AI</span>
          ) : null}
        </div>
        {open && (
          <div role="group">
            {Array.isArray(node.children) && node.children.map((child) => (
              <RenderNode key={child.name} node={child} basePath={full} depth={depth + 1}
                activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles}
                writingFiles={writingFiles} writingSizes={writingSizes}
                hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
                focusedPath={focusedPath} setFocusedPath={setFocusedPath}
                onSelect={onSelect} onContextMenu={onContextMenu} searchQuery={searchQuery} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={rowStyle}
      role="treeitem"
      aria-selected={active}
      tabIndex={focused ? 0 : -1}
      data-tree-row="true"
      data-tree-path={full}
      data-tree-type="file"
      data-tree-expanded="false"
      onClick={() => { setFocusedPath(full); onSelect(full); }}
      onContextMenu={(e) => onContextMenu(e, full, false)}
      onMouseEnter={() => setHoveredPath(full)}
      onMouseLeave={() => setHoveredPath(null)}
      data-testid={`file-${node.name}`}
    >
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} style={{
          position: "absolute", left: 4 + i * INDENT + 5,
          top: 0, bottom: 0, width: 1,
          background: "#202020", pointerEvents: "none",
        }} />
      ))}
      <span style={{ width: 11, flexShrink: 0, zIndex: 1 }} />
      {fileIcon(node.name, "file")}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {highlightName(node.name)}
      </span>
      {writing ? (
        <span className="rfe-badge"><span className="rfe-spinner" />{writeSize !== undefined ? formatBytes(writeSize) : "…"}</span>
      ) : dirty ? (
        <span title="Modified" style={{ fontSize: 9, padding: "0 3px", borderRadius: 2, background: "rgba(245,158,11,.15)", color: "#f59e0b", flexShrink: 0, letterSpacing: .2 }}>M</span>
      ) : ai ? (
        <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "rgba(34,197,94,.15)", color: "#4ade80", letterSpacing: .3 }}>AI</span>
      ) : null}
    </div>
  );
}

// ── Inline creation row ────────────────────────────────────────────────────────
function InlineCreateRow({
  type, onConfirm, onCancel,
}: { type: "file" | "folder"; onConfirm: (name: string) => void; onCancel: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "2px 6px 2px 8px", height: 22,
      borderBottom: "1px solid #222", background: "#1e1e1e",
    }}>
      {type === "file"
        ? <FilePlus   style={{ width: 11, height: 11, color: "#60a5fa", flexShrink: 0 }} />
        : <FolderPlus style={{ width: 11, height: 11, color: "#e8a427", flexShrink: 0 }} />}
      <InlineInput
        initialValue={type === "file" ? "untitled.tsx" : "new-folder"}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </div>
  );
}

export default function FileExplorer({ projectPath, onSelect, onFileSelect, activeFile }: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating]       = useState<"file" | "folder" | null>(null);
  const [width, setWidth]             = useState(loadWidth);
  const searchRef    = useRef<HTMLInputElement>(null);
  const dragRef      = useRef<{ startX: number; startW: number } | null>(null);
  const handleRef    = useRef<HTMLDivElement>(null);
  const treeScrollRef = useRef<HTMLDivElement>(null);

  const selectHandler = onFileSelect ?? onSelect;

  const {
    tree, dirtyFiles, aiFiles, writingFiles, writingSizes, hoveredPath, focusedPath,
    setHoveredPath, setFocusedPath, refreshFiles, apiSaveFile,
    handleRenamePath, handleDeletePath,
  } = useFileExplorer({ projectPath, activeFile });

  const { openFiles, openFile, closeFile, closeAll } = useOpenEditors();
  const { recentFiles, recordOpen } = useRecentFiles();

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
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
  }, [width]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    handleRef.current?.classList.add("dragging");
    document.body.style.cursor = "col-resize";
  };

  // ── P1 #4 — Reveal active file: expand parents + scroll into view ──────────
  useEffect(() => {
    if (!activeFile || !projectPath) return;
    const relative = activeFile.startsWith(projectPath + "/")
      ? activeFile.slice(projectPath.length + 1)
      : activeFile;
    const parts = relative.split("/").filter(Boolean);
    // Expand every ancestor folder
    let cur = projectPath;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur + "/" + parts[i];
      window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: cur, expanded: true } }));
    }
    // After state settles, scroll the active row into view
    const timer = setTimeout(() => {
      if (!treeScrollRef.current) return;
      const el = Array.from(treeScrollRef.current.querySelectorAll("[data-tree-row]"))
        .find(el => el.getAttribute("data-tree-path") === activeFile) as HTMLElement | undefined;
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        setFocusedPath(activeFile);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeFile, projectPath]);

  // ── P1 #2 — Keyboard navigation on the tree container ─────────────────────
  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    const container = treeScrollRef.current;
    if (!container) return;

    const rows = Array.from(
      container.querySelectorAll("[data-tree-row]")
    ) as HTMLElement[];
    if (!rows.length) return;

    const curIdx = rows.findIndex(el => el.getAttribute("data-tree-path") === focusedPath);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = rows[Math.min(rows.length - 1, curIdx + 1)];
        if (next) {
          const path = next.getAttribute("data-tree-path")!;
          setFocusedPath(path);
          next.scrollIntoView({ block: "nearest" });
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = rows[Math.max(0, curIdx - 1)];
        if (prev) {
          const path = prev.getAttribute("data-tree-path")!;
          setFocusedPath(path);
          prev.scrollIntoView({ block: "nearest" });
        }
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        const row = rows[curIdx];
        if (row?.getAttribute("data-tree-type") === "folder" && row.getAttribute("data-tree-expanded") !== "true") {
          window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: focusedPath, expanded: true } }));
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        const row = rows[curIdx];
        if (row?.getAttribute("data-tree-type") === "folder" && row.getAttribute("data-tree-expanded") === "true") {
          window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: focusedPath, expanded: false } }));
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (!focusedPath) break;
        const row = rows[curIdx];
        if (row?.getAttribute("data-tree-type") === "folder") {
          const expanded = row.getAttribute("data-tree-expanded") === "true";
          window.dispatchEvent(new CustomEvent("rfe:set-expanded", { detail: { path: focusedPath, expanded: !expanded } }));
        } else {
          handleSelect(focusedPath);
        }
        break;
      }
      case " ": {
        e.preventDefault();
        if (focusedPath) setFocusedPath(focusedPath);
        break;
      }
      case "Home": {
        e.preventDefault();
        const first = rows[0];
        if (first) { setFocusedPath(first.getAttribute("data-tree-path")!); first.scrollIntoView({ block: "nearest" }); }
        break;
      }
      case "End": {
        e.preventDefault();
        const last = rows[rows.length - 1];
        if (last) { setFocusedPath(last.getAttribute("data-tree-path")!); last.scrollIntoView({ block: "nearest" }); }
        break;
      }
    }
  };

  // ── File select — records open + recent ───────────────────────────────────
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
    ? projectPath.split("/").filter(Boolean).pop() ?? "workspace"
    : "workspace";

  const hdrBtn = (Icon: React.ElementType, title: string, onClick: () => void) => (
    <button key={title} title={title} onClick={onClick}
      style={{
        width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", border: "none", cursor: "pointer",
        borderRadius: 3, color: "#3a3a3a", transition: "background .1s, color .1s", flexShrink: 0,
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#b4b4b4"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "#3a3a3a"; }}
    >
      <Icon style={{ width: 12, height: 12 }} />
    </button>
  );

  return (
    <div
      className="rfe-sidebar"
      style={{
        width, display: "flex", flexDirection: "column", position: "relative",
        background: "#1c1c1c", borderRight: "1px solid #252525",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontSize: 12, height: "100%", flexShrink: 0,
      }}
      onClick={() => { if (contextMenu) closeCtx(); }}
    >
      {/* ── Open Editors panel ── */}
      <OpenEditorsPanel
        files={openFiles}
        activeFile={activeFile}
        onSelect={(path) => { selectHandler?.(path); }}
        onClose={closeFile}
        onCloseAll={closeAll}
      />

      {/* ── Recent Files panel ── */}
      <RecentFilesPanel
        files={recentFiles}
        activeFile={activeFile}
        onSelect={(path) => { handleSelect(path); }}
      />

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 4px 0 8px", height: 32, flexShrink: 0,
        borderBottom: "1px solid #252525",
      }}>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#4a4a4a", textTransform: "uppercase", letterSpacing: ".08em" }}>
            Files
          </span>
          {projectPath && (
            <span style={{ fontSize: 9, color: "#303030", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={projectPath}>
              {workspaceName} · {fileCount}f {folderCount}d
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
          {hdrBtn(FilePlus,   "New File",    () => setCreating("file"))}
          {hdrBtn(FolderPlus, "New Folder",  () => setCreating("folder"))}
          {hdrBtn(RotateCcw,  "Refresh",     () => refreshFiles())}
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: "4px 6px", flexShrink: 0, borderBottom: "1px solid #1e1e1e" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "2px 6px", borderRadius: 4,
          background: "#141414", border: "1px solid #232323",
        }}>
          <Search style={{ width: 11, height: 11, color: "#363636", flexShrink: 0 }} />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 12, color: "#c4c4c4", caretColor: "#3b82f6", fontFamily: "inherit",
            }}
            data-testid="input-explorer-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#3a3a3a", display: "flex", padding: 0 }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Inline create row ── */}
      {creating && (
        <InlineCreateRow
          type={creating}
          onConfirm={creating === "file" ? createFile : createFolder}
          onCancel={() => setCreating(null)}
        />
      )}

      {/* ── Tree / Empty state ── */}
      <div
        ref={treeScrollRef}
        role="tree"
        aria-label="File explorer"
        tabIndex={0}
        style={{ flex: 1, overflowY: "auto", padding: "2px 0", outline: "none" }}
        onKeyDown={handleTreeKeyDown}
      >
        {isEmpty && !creating ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "20px 12px 14px", gap: 8,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: "#202020", border: "1px solid #2a2a2a",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FolderPlus style={{ width: 13, height: 13, color: "#3a3a3a" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#555", fontWeight: 500, marginBottom: 4 }}>No files yet</div>
              <div style={{ fontSize: 11, color: "#363636", lineHeight: 1.5 }}>
                Create a file or folder<br />to get started
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { label: "New file",   Icon: FilePlus,   onClick: () => setCreating("file") },
                { label: "New folder", Icon: FolderPlus, onClick: () => setCreating("folder") },
              ].map(({ label, Icon, onClick }) => (
                <button key={label} onClick={onClick}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                    background: "#222", border: "1px solid #2e2e2e",
                    color: "#666", fontSize: 11, fontFamily: "inherit", transition: "all .1s",
                  }}
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
              writingFiles={writingFiles} writingSizes={writingSizes}
              hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
              focusedPath={focusedPath} setFocusedPath={setFocusedPath}
              onSelect={handleSelect}
              onContextMenu={openCtx}
              searchQuery={searchQuery} />
          ))
        )}
      </div>

      {/* ── Agent status panel ── */}
      <AgentStatusPanel />

      {/* ── Context menu ── */}
      <ContextMenu
        menu={contextMenu}
        targetPath={contextMenu?.path ?? ""}
        onNewFile={() => { closeCtx(); setCreating("file"); }}
        onNewFolder={() => { closeCtx(); setCreating("folder"); }}
        onRename={async () => { if (contextMenu) { await handleRenamePath(contextMenu.path); closeCtx(); } }}
        onDelete={async () => { if (contextMenu) { await handleDeletePath(contextMenu.path); closeCtx(); } }}
        onClose={closeCtx}
      />

      {/* ── Resize handle ── */}
      <div
        ref={handleRef}
        className="rfe-resize-handle"
        onMouseDown={startResize}
        data-testid="sidebar-resize-handle"
      />
    </div>
  );
}
