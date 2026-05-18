import { RawTreeNode } from "./types";
import { emojiIcon } from "./file-icon";
import { ContextMenu } from "./ContextMenu";
import { useFileExplorer } from "./use-file-explorer";
import { useState } from "react";

// Keyframe injection — done once at module scope, avoids re-injecting on re-renders
if (typeof document !== "undefined" && !document.getElementById("__fe-anim__")) {
  const s = document.createElement("style");
  s.id = "__fe-anim__";
  s.textContent = `
    @keyframes fe-writing-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.45; }
    }
    @keyframes fe-writing-dots {
      0%   { content: ""; }
      33%  { content: "."; }
      66%  { content: ".."; }
      100% { content: "..."; }
    }
    .fe-writing-row {
      border-left: 2px solid #7c8dff !important;
      background: rgba(124,141,255,0.07) !important;
    }
    .fe-writing-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      margin-left: auto;
      font-size: 10px;
      padding: 0 5px;
      border-radius: 6px;
      background: rgba(124,141,255,0.18);
      color: #a5b4fc;
      animation: fe-writing-pulse 1.1s ease-in-out infinite;
      white-space: nowrap;
    }
    .fe-writing-spinner {
      width: 7px;
      height: 7px;
      border: 1.5px solid rgba(124,141,255,0.35);
      border-top-color: #a5b4fc;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(s);
}

interface FileExplorerProps {
  projectPath: string;
  onSelect?: (path: string) => void;
  activeFile?: string;
}

function RenderNode({
  node, basePath, activeFile, dirtyFiles, aiFiles, writingFiles, hoveredPath,
  setHoveredPath, setFocusedPath, onSelect, onContextMenu,
}: {
  node: RawTreeNode;
  basePath: string;
  activeFile?: string;
  dirtyFiles: Set<string>;
  aiFiles: Set<string>;
  writingFiles: Set<string>;
  hoveredPath: string | null;
  setHoveredPath: (p: string | null) => void;
  setFocusedPath: (p: string | null) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
}) {
  const type    = node.type === "folder" ? "directory" : node.type;
  const full    = (basePath && basePath !== "/" ? basePath + "/" : "") + node.name;
  const isDir   = type === "directory";
  const active  = !!activeFile && activeFile === full;
  const dirty   = dirtyFiles.has(full);
  const ai      = aiFiles.has(full);
  const writing = writingFiles.has(full);
  const hovered = hoveredPath === full;

  const rowStyle: React.CSSProperties = {
    padding: "2px 6px", cursor: "pointer",
    display: "flex", alignItems: "center", gap: 6,
    background: writing
      ? "rgba(124,141,255,0.07)"
      : active
        ? "#16355a"
        : hovered
          ? "#020617"
          : "transparent",
    color: "#f9fafb", fontSize: 13,
    borderLeft: writing ? "2px solid #7c8dff" : "2px solid transparent",
  };

  const writingBadge = (
    <span className="fe-writing-badge">
      <span className="fe-writing-spinner" />
      writing
    </span>
  );

  const aiBadge = (
    <span style={{ marginLeft: "auto", fontSize: 10, padding: "0 4px",
      borderRadius: 6, background: "#22c55e33", color: "#22c55e" }}>AI</span>
  );

  if (isDir) {
    return (
      <div key={full}>
        <div style={rowStyle}
          onClick={() => { setFocusedPath(full); onSelect(full); }}
          onContextMenu={(e) => onContextMenu(e, full, true)}
          onMouseEnter={() => setHoveredPath(full)}
          onMouseLeave={() => setHoveredPath(null)}
          data-testid={`folder-${node.name}`}>
          <span>{emojiIcon(node.name, type)}</span>
          <span>{node.name}</span>
          {writing ? writingBadge : ai ? aiBadge : null}
        </div>
        <div style={{ paddingLeft: 12 }}>
          {Array.isArray(node.children) &&
            node.children.map((child) => (
              <RenderNode key={child.name} node={child} basePath={full}
                activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles}
                writingFiles={writingFiles}
                hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
                setFocusedPath={setFocusedPath} onSelect={onSelect}
                onContextMenu={onContextMenu} />
            ))}
        </div>
      </div>
    );
  }

  return (
    <div key={full} style={rowStyle}
      onClick={() => { setFocusedPath(full); onSelect(full); }}
      onContextMenu={(e) => onContextMenu(e, full, false)}
      onMouseEnter={() => setHoveredPath(full)}
      onMouseLeave={() => setHoveredPath(null)}
      data-testid={`file-${node.name}`}>
      <span>{emojiIcon(node.name, type)}</span>
      <span>{node.name}</span>
      {writing
        ? writingBadge
        : dirty
          ? <span style={{ marginLeft: "auto" }}>•</span>
          : ai
            ? aiBadge
            : null}
    </div>
  );
}

export default function FileExplorer({ projectPath, onSelect, activeFile }: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);

  const {
    tree, dirtyFiles, aiFiles, writingFiles, hoveredPath, setHoveredPath,
    setFocusedPath, refreshFiles, apiSaveFile,
    handleRenamePath, handleDeletePath,
  } = useFileExplorer({ projectPath, activeFile });

  const openContextMenu = (e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path, isDir });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleNewFile = async () => {
    if (!contextMenu) return;
    const base = contextMenu.isDir
      ? contextMenu.path
      : contextMenu.path.replace(/\/[^/]+$/, "");
    const name = window.prompt("New file name:");
    if (!name) return;
    const full = (base.endsWith("/") ? base : base + "/") + name;
    try { await apiSaveFile(full, ""); refreshFiles(full); }
    catch (e) { console.error(e); alert("New file failed."); }
    finally { closeContextMenu(); }
  };

  const handleNewFolder = async () => {
    if (!contextMenu) return;
    const base = contextMenu.isDir
      ? contextMenu.path
      : contextMenu.path.replace(/\/[^/]+$/, "");
    const name = window.prompt("New folder name:");
    if (!name) return;
    const full = (base.endsWith("/") ? base : base + "/") + name + "/.keep";
    try { await apiSaveFile(full, ""); refreshFiles(full); }
    catch (e) { console.error(e); alert("New folder failed."); }
    finally { closeContextMenu(); }
  };

  const handleRename = async () => {
    if (!contextMenu) return;
    await handleRenamePath(contextMenu.path);
    closeContextMenu();
  };

  const handleDelete = async () => {
    if (!contextMenu) return;
    await handleDeletePath(contextMenu.path);
    closeContextMenu();
  };

  return (
    <div style={{ width: 260, background: "#020617", color: "#e5e7eb",
        borderRight: "1px solid #111827", fontFamily: "system-ui, sans-serif",
        fontSize: 13, position: "relative" }}
      onClick={() => { if (contextMenu) closeContextMenu(); }}>
      <div style={{ padding: "6px 8px", borderBottom: "1px solid #111827",
          fontSize: 12, textTransform: "uppercase", letterSpacing: 0.08, color: "#9ca3af" }}>
        Files
      </div>
      <div style={{ padding: 4, overflowY: "auto", height: "calc(100vh - 32px)" }}>
        {tree.map((node) => (
          <RenderNode key={node.name} node={node} basePath={projectPath || ""}
            activeFile={activeFile} dirtyFiles={dirtyFiles} aiFiles={aiFiles}
            writingFiles={writingFiles}
            hoveredPath={hoveredPath} setHoveredPath={setHoveredPath}
            setFocusedPath={setFocusedPath}
            onSelect={(path) => onSelect && onSelect(path)}
            onContextMenu={openContextMenu} />
        ))}
      </div>
      <ContextMenu menu={contextMenu}
        onNewFile={handleNewFile} onNewFolder={handleNewFolder}
        onRename={handleRename} onDelete={handleDelete} />
    </div>
  );
}
