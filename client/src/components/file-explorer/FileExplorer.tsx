import { RawTreeNode } from "./types";
import { fileIcon } from "./file-icon";
import { ContextMenu } from "./ContextMenu";
import { useFileExplorer } from "./use-file-explorer";
import { useState } from "react";
import { ChevronRight, ChevronDown, FilePlus, FolderPlus, RotateCcw } from "lucide-react";

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

// Inject animations once
if (typeof document !== "undefined" && !document.getElementById("__rfe-anim__")) {
  const s = document.createElement("style");
  s.id = "__rfe-anim__";
  s.textContent = `
    @keyframes rfe-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes rfe-spin  { to{transform:rotate(360deg)} }
    .rfe-writing-row { border-left:2px solid #3b82f6!important; background:rgba(59,130,246,.06)!important; }
    .rfe-spinner { width:6px;height:6px;border:1.5px solid rgba(59,130,246,.3);border-top-color:#60a5fa;border-radius:50%;animation:rfe-spin .7s linear infinite; }
    .rfe-badge { display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(59,130,246,.15);color:#93c5fd;animation:rfe-pulse 1.2s ease infinite;white-space:nowrap; }
    .rfe-row::-webkit-scrollbar{display:none}
    .rfe-sidebar ::-webkit-scrollbar{width:3px}
    .rfe-sidebar ::-webkit-scrollbar-track{background:transparent}
    .rfe-sidebar ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
    .rfe-sidebar ::-webkit-scrollbar-thumb:hover{background:#444}
  `;
  document.head.appendChild(s);
}

interface FileExplorerProps {
  projectPath: string;
  onSelect?: (path: string) => void;
  activeFile?: string;
}

function RenderNode({
  node, basePath, depth, activeFile, dirtyFiles, aiFiles,
  writingFiles, writingSizes, hoveredPath, setHoveredPath,
  setFocusedPath, onSelect, onContextMenu,
}: {
  node: RawTreeNode; basePath: string; depth: number;
  activeFile?: string; dirtyFiles: Set<string>; aiFiles: Set<string>;
  writingFiles: Set<string>; writingSizes: Map<string, number>;
  hoveredPath: string | null;
  setHoveredPath: (p: string | null) => void;
  setFocusedPath: (p: string | null) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isDir    = node.type === "folder" || node.type === "directory";
  const full     = (basePath && basePath !== "/" ? basePath + "/" : "") + node.name;
  const active   = !!activeFile && activeFile === full;
  const dirty    = dirtyFiles.has(full);
  const ai       = aiFiles.has(full);
  const writing  = writingFiles.has(full);
  const writeSize = writingSizes.get(full);
  const hovered  = hoveredPath === full;
  const indent   = 8 + depth * 16;

  const rowBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4,
    height: 22, paddingRight: 6, cursor: "pointer",
    paddingLeft: indent,
    fontSize: 12, userSelect: "none",
    borderLeft: writing ? "2px solid #3b82f6"
      : active ? "2px solid #3b82f6"
      : "2px solid transparent",
    background: writing ? "rgba(59,130,246,.06)"
      : active ? "#2a2a2a"
      : hovered ? "#252525"
      : "transparent",
    color: active ? "#f0f0f0" : "#c4c4c4",
    transition: "background .1s, color .1s",
  };

  if (isDir) {
    return (
      <div>
        <div
          style={rowBase}
          onClick={() => { setFocusedPath(full); setOpen(v => !v); onSelect(full); }}
          onContextMenu={(e) => onContextMenu(e, full, true)}
          onMouseEnter={() => setHoveredPath(full)}
          onMouseLeave={() => setHoveredPath(null)}
          data-testid={`folder-${node.name}`}
        >
          <span style={{ color: "#555", flexShrink: 0, display: "flex" }}>
            {open
              ? <ChevronDown  style={{ width: 11, height: 11 }} />
              : <ChevronRight style={{ width: 11, height: 11 }} />}
          </span>
          {fileIcon(node.name, "folder", open)}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
          {writing ? (
            <span className="rfe-badge"><span className="rfe-spinner" />{writeSize !== undefined ? formatBytes(writeSize) : "…"}</span>
          ) : ai ? (
            <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "rgba(34,197,94,.15)", color: "#4ade80", letterSpacing: .3 }}>AI</span>
          ) : null}
        </div>
        {open && (
          <div>
            {Array.isArray(node.children) && node.children.map((child) => (
              <RenderNode key={child.name} node={child} basePath={full} depth={depth + 1}
                activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles}
                writingFiles={writingFiles} writingSizes={writingSizes}
                hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
                setFocusedPath={setFocusedPath} onSelect={onSelect}
                onContextMenu={onContextMenu} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={rowBase}
      onClick={() => { setFocusedPath(full); onSelect(full); }}
      onContextMenu={(e) => onContextMenu(e, full, false)}
      onMouseEnter={() => setHoveredPath(full)}
      onMouseLeave={() => setHoveredPath(null)}
      data-testid={`file-${node.name}`}
    >
      <span style={{ width: 11, flexShrink: 0 }} />
      {fileIcon(node.name, "file")}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name}
      </span>
      {writing ? (
        <span className="rfe-badge"><span className="rfe-spinner" />{writeSize !== undefined ? formatBytes(writeSize) : "…"}</span>
      ) : dirty ? (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
      ) : ai ? (
        <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "rgba(34,197,94,.15)", color: "#4ade80", letterSpacing: .3 }}>AI</span>
      ) : null}
    </div>
  );
}

export default function FileExplorer({ projectPath, onSelect, activeFile }: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);

  const {
    tree, dirtyFiles, aiFiles, writingFiles, writingSizes, hoveredPath,
    setHoveredPath, setFocusedPath, refreshFiles, apiSaveFile,
    handleRenamePath, handleDeletePath,
  } = useFileExplorer({ projectPath, activeFile });

  const openCtx = (e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, path, isDir });
  };
  const closeCtx = () => setContextMenu(null);

  const handleNewFile = async () => {
    if (!contextMenu) return;
    const base = contextMenu.isDir ? contextMenu.path : contextMenu.path.replace(/\/[^/]+$/, "");
    const name = window.prompt("New file name:");
    if (!name) return;
    const full = (base.endsWith("/") ? base : base + "/") + name;
    try { await apiSaveFile(full, ""); refreshFiles(full); } catch {}
    finally { closeCtx(); }
  };

  const handleNewFolder = async () => {
    if (!contextMenu) return;
    const base = contextMenu.isDir ? contextMenu.path : contextMenu.path.replace(/\/[^/]+$/, "");
    const name = window.prompt("New folder name:");
    if (!name) return;
    const full = (base.endsWith("/") ? base : base + "/") + name + "/.keep";
    try { await apiSaveFile(full, ""); refreshFiles(full); } catch {}
    finally { closeCtx(); }
  };

  return (
    <div
      className="rfe-sidebar"
      style={{
        width: 240, display: "flex", flexDirection: "column",
        background: "#1c1c1c", borderRight: "1px solid #2e2e2e",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontSize: 12, position: "relative", height: "100%",
      }}
      onClick={() => { if (contextMenu) closeCtx(); }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 8px", height: 36, flexShrink: 0,
        borderBottom: "1px solid #2a2a2a",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: ".08em" }}>
          Files
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          {[
            { Icon: FilePlus, title: "New File", onClick: async () => {
              const name = window.prompt("New file name:");
              if (!name) return;
              const full = (projectPath ? projectPath + "/" : "") + name;
              try { await apiSaveFile(full, ""); refreshFiles(full); } catch {}
            }},
            { Icon: FolderPlus, title: "New Folder", onClick: async () => {
              const name = window.prompt("New folder name:");
              if (!name) return;
              const full = (projectPath ? projectPath + "/" : "") + name + "/.keep";
              try { await apiSaveFile(full, ""); refreshFiles(full); } catch {}
            }},
            { Icon: RotateCcw, title: "Refresh", onClick: () => refreshFiles() },
          ].map(({ Icon, title, onClick }) => (
            <button key={title} title={title} onClick={onClick}
              style={{
                width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer",
                borderRadius: 4, color: "#555", transition: "background .1s, color .1s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#2e2e2e"; (e.currentTarget as HTMLElement).style.color = "#ccc"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#555"; }}
            >
              <Icon style={{ width: 13, height: 13 }} />
            </button>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {tree.length === 0 ? (
          <div style={{ padding: "16px 12px", color: "#444", fontSize: 11, textAlign: "center" }}>
            No files yet
          </div>
        ) : (
          tree.map((node) => (
            <RenderNode key={node.name} node={node} basePath={projectPath || ""} depth={0}
              activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles}
              writingFiles={writingFiles} writingSizes={writingSizes}
              hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
              setFocusedPath={setFocusedPath}
              onSelect={(path) => onSelect && onSelect(path)}
              onContextMenu={openCtx} />
          ))
        )}
      </div>

      <ContextMenu menu={contextMenu}
        onNewFile={handleNewFile} onNewFolder={handleNewFolder}
        onRename={async () => { if (contextMenu) { await handleRenamePath(contextMenu.path); closeCtx(); } }}
        onDelete={async () => { if (contextMenu) { await handleDeletePath(contextMenu.path); closeCtx(); } }} />
    </div>
  );
}
