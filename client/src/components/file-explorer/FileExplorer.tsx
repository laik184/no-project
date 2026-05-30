import { RawTreeNode } from "./types";
import { fileIcon } from "./file-icon";
import { ContextMenu } from "./ContextMenu";
import { useFileExplorer } from "./use-file-explorer";
import { useState, useRef } from "react";
import { ChevronRight, ChevronDown, FilePlus, FolderPlus, RotateCcw, Search, X } from "lucide-react";
import { InlineInput } from "./InlineInput";

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
    .rfe-spinner { width:6px;height:6px;border:1.5px solid rgba(59,130,246,.3);border-top-color:#60a5fa;border-radius:50%;animation:rfe-spin .7s linear infinite; }
    .rfe-badge { display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(59,130,246,.15);color:#93c5fd;animation:rfe-pulse 1.2s ease infinite;white-space:nowrap; }
    .rfe-sidebar ::-webkit-scrollbar{width:3px}
    .rfe-sidebar ::-webkit-scrollbar-track{background:transparent}
    .rfe-sidebar ::-webkit-scrollbar-thumb{background:#2e2e2e;border-radius:2px}
    .rfe-sidebar ::-webkit-scrollbar-thumb:hover{background:#3a3a3a}
  `;
  document.head.appendChild(s);
}

interface FileExplorerProps {
  projectPath: string;
  onSelect?: (path: string) => void;
  activeFile?: string;
}

// Indent guide line width per level
const INDENT = 16;

function RenderNode({
  node, basePath, depth, activeFile, dirtyFiles, aiFiles,
  writingFiles, writingSizes, hoveredPath, setHoveredPath,
  setFocusedPath, onSelect, onContextMenu, searchQuery,
}: {
  node: RawTreeNode; basePath: string; depth: number;
  activeFile?: string; dirtyFiles: Set<string>; aiFiles: Set<string>;
  writingFiles: Set<string>; writingSizes: Map<string, number>;
  hoveredPath: string | null;
  setHoveredPath: (p: string | null) => void;
  setFocusedPath: (p: string | null) => void;
  onSelect: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
  searchQuery: string;
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

  // Search filter — hide nodes that don't match
  const sq = searchQuery.trim().toLowerCase();
  if (sq && !node.name.toLowerCase().includes(sq) && !isDir) return null;

  const paddingLeft = 8 + depth * INDENT;

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 4,
    height: 22, paddingRight: 6, paddingLeft,
    cursor: "pointer", userSelect: "none", fontSize: 12,
    position: "relative",
    borderLeft: active ? "2px solid #3b82f6"
      : writing ? "2px solid #3b82f6"
      : "2px solid transparent",
    background: writing ? "rgba(59,130,246,.06)"
      : active ? "#2a2a2a"
      : hovered ? "#252525"
      : "transparent",
    color: active ? "#f0f0f0" : "#b4b4b4",
    transition: "background .1s, color .1s",
    fontFamily: "'Inter', system-ui, sans-serif",
  };

  if (isDir) {
    return (
      <div>
        <div
          style={rowStyle}
          onClick={() => { setFocusedPath(full); setOpen(v => !v); onSelect(full); }}
          onContextMenu={(e) => onContextMenu(e, full, true)}
          onMouseEnter={() => setHoveredPath(full)}
          onMouseLeave={() => setHoveredPath(null)}
          data-testid={`folder-${node.name}`}
        >
          {/* Indent guide lines */}
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} style={{
              position: "absolute",
              left: 8 + i * INDENT + 5,
              top: 0, bottom: 0, width: 1,
              background: "#252525",
              pointerEvents: "none",
            }} />
          ))}
          <span style={{ color: "#4a4a4a", flexShrink: 0, display: "flex", zIndex: 1 }}>
            {open
              ? <ChevronDown  style={{ width: 11, height: 11 }} />
              : <ChevronRight style={{ width: 11, height: 11 }} />}
          </span>
          {fileIcon(node.name, "folder", open)}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: hovered || active ? "#d4d4d4" : "#aaaaaa" }}>
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
                onContextMenu={onContextMenu} searchQuery={searchQuery} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={rowStyle}
      onClick={() => { setFocusedPath(full); onSelect(full); }}
      onContextMenu={(e) => onContextMenu(e, full, false)}
      onMouseEnter={() => setHoveredPath(full)}
      onMouseLeave={() => setHoveredPath(null)}
      data-testid={`file-${node.name}`}
    >
      {/* Indent guide lines */}
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} style={{
          position: "absolute",
          left: 8 + i * INDENT + 5,
          top: 0, bottom: 0, width: 1,
          background: "#252525",
          pointerEvents: "none",
        }} />
      ))}
      {/* Spacer aligns files with folder chevron */}
      <span style={{ width: 11, flexShrink: 0, zIndex: 1 }} />
      {fileIcon(node.name, "file")}
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name}
      </span>
      {writing ? (
        <span className="rfe-badge"><span className="rfe-spinner" />{writeSize !== undefined ? formatBytes(writeSize) : "…"}</span>
      ) : dirty ? (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} title="Unsaved changes" />
      ) : ai ? (
        <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "rgba(34,197,94,.15)", color: "#4ade80", letterSpacing: .3 }}>AI</span>
      ) : null}
    </div>
  );
}

// ── Inline creation row (appears at top of tree) ──────────────────────────────
function InlineCreateRow({
  type, onConfirm, onCancel,
}: { type: "file" | "folder"; onConfirm: (name: string) => void; onCancel: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "3px 8px 3px 10px", height: 26,
      borderBottom: "1px solid #222", background: "#1e1e1e",
    }}>
      {type === "file"
        ? <FilePlus   style={{ width: 12, height: 12, color: "#60a5fa", flexShrink: 0 }} />
        : <FolderPlus style={{ width: 12, height: 12, color: "#e8a427", flexShrink: 0 }} />}
      <InlineInput
        initialValue={type === "file" ? "untitled.tsx" : "new-folder"}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </div>
  );
}

export default function FileExplorer({ projectPath, onSelect, activeFile }: FileExplorerProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating]       = useState<"file" | "folder" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    tree, dirtyFiles, aiFiles, writingFiles, writingSizes, hoveredPath,
    setHoveredPath, setFocusedPath, refreshFiles, apiSaveFile,
    handleRenamePath, handleDeletePath,
  } = useFileExplorer({ projectPath, activeFile });

  const openCtx = (e: React.MouseEvent, path: string, isDir: boolean) => {
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

  const isEmpty = tree.length === 0;

  const hdrBtn = (Icon: React.ElementType, title: string, onClick: () => void) => (
    <button key={title} title={title} onClick={onClick}
      style={{
        width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
        background: "transparent", border: "none", cursor: "pointer",
        borderRadius: 4, color: "#4a4a4a", transition: "background .1s, color .1s",
        flexShrink: 0,
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#b4b4b4"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = "#4a4a4a"; }}
    >
      <Icon style={{ width: 13, height: 13 }} />
    </button>
  );

  return (
    <div
      className="rfe-sidebar"
      style={{
        width: 240, display: "flex", flexDirection: "column",
        background: "#1c1c1c", borderRight: "1px solid #252525",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        fontSize: 12, position: "relative", height: "100%",
      }}
      onClick={() => { if (contextMenu) closeCtx(); }}
    >
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 6px 0 10px", height: 36, flexShrink: 0,
        borderBottom: "1px solid #252525",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#4a4a4a", textTransform: "uppercase", letterSpacing: ".08em" }}>
          Files
        </span>
        <div style={{ display: "flex", gap: 1 }}>
          {hdrBtn(FilePlus,   "New File",   () => { closeCtx(); setCreating("file"); })}
          {hdrBtn(FolderPlus, "New Folder", () => { closeCtx(); setCreating("folder"); })}
          {hdrBtn(RotateCcw,  "Refresh",    () => refreshFiles())}
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: "5px 8px", flexShrink: 0, borderBottom: "1px solid #222" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "3px 8px", borderRadius: 4,
          background: "#141414", border: "1px solid #272727",
        }}>
          <Search style={{ width: 11, height: 11, color: "#3a3a3a", flexShrink: 0 }} />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 12, color: "#c4c4c4", caretColor: "#3b82f6",
              fontFamily: "inherit",
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
      <div style={{ flex: 1, overflowY: "auto", padding: "2px 0" }}>
        {isEmpty && !creating ? (
          /* Replit-style empty state */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "28px 16px 20px", gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#202020", border: "1px solid #2a2a2a",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FolderPlus style={{ width: 16, height: 16, color: "#3a3a3a" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#555", fontWeight: 500, marginBottom: 4 }}>No files yet</div>
              <div style={{ fontSize: 11, color: "#363636", lineHeight: 1.5 }}>
                Create a file or folder<br />to get started
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              {[
                { label: "New file",   Icon: FilePlus,   onClick: () => setCreating("file") },
                { label: "New folder", Icon: FolderPlus, onClick: () => setCreating("folder") },
              ].map(({ label, Icon, onClick }) => (
                <button key={label} onClick={onClick}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                    background: "#222", border: "1px solid #2e2e2e",
                    color: "#666", fontSize: 11, fontFamily: "inherit",
                    transition: "all .1s",
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
              setFocusedPath={setFocusedPath}
              onSelect={(path) => onSelect && onSelect(path)}
              onContextMenu={openCtx}
              searchQuery={searchQuery} />
          ))
        )}
      </div>

      <ContextMenu
        menu={contextMenu}
        onNewFile={() => { closeCtx(); setCreating("file"); }}
        onNewFolder={() => { closeCtx(); setCreating("folder"); }}
        onRename={async () => { if (contextMenu) { await handleRenamePath(contextMenu.path); closeCtx(); } }}
        onDelete={async () => { if (contextMenu) { await handleDeletePath(contextMenu.path); closeCtx(); } }}
      />
    </div>
  );
}
