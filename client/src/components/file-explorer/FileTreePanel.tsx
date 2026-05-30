import { useState, useRef } from "react";
import { Search, X, FilePlus, FolderPlus } from "lucide-react";
import { FileNode } from "./types";
import { guessLang, fileIcon } from "./file-icon";
import {
  flattenFiles, deleteNodeById, renameNodeById, addNodeToRoot, uid,
} from "./tree-helpers";
import { TreeNode } from "./TreeNode";
import { ActionIcon, InlineInput } from "./InlineInput";

interface FileTreePanelProps {
  onFileOpen: (name: string, content: string, lang: string) => void;
  onClose: () => void;
  activeFileName?: string;
}

export function FileTreePanel({ onFileOpen, onClose, activeFileName = "" }: FileTreePanelProps) {
  // Replit behavior: fresh/empty start — no fake demo files
  const [tree, setTree]                   = useState<FileNode[]>([]);
  const [searchQuery, setSearchQuery]     = useState("");
  const [creatingFile, setCreatingFile]   = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const sq = searchQuery.trim().toLowerCase();
  const searchResults = sq ? flattenFiles(tree).filter(({ path }) => path.toLowerCase().includes(sq)) : [];

  const handleSelect = (node: FileNode) => {
    if (node.type === "file")
      onFileOpen(node.name, node.content ?? "", node.lang ?? guessLang(node.name));
  };

  const handleDelete = (id: string) => setTree((prev) => deleteNodeById(prev, id));
  const handleRename = (id: string, newName: string) => setTree((prev) => renameNodeById(prev, id, newName));

  const handleNewFile = (name: string) => {
    const node: FileNode = { id: uid(), name, type: "file", lang: guessLang(name), content: "" };
    setTree((prev) => addNodeToRoot(prev, node));
    setCreatingFile(false);
    onFileOpen(name, "", guessLang(name));
  };

  const handleNewFolder = (name: string) => {
    const node: FileNode = { id: uid(), name, type: "folder", children: [] };
    setTree((prev) => addNodeToRoot(prev, node));
    setCreatingFolder(false);
  };

  const isEmpty = tree.length === 0 && !creatingFile && !creatingFolder;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
      background: "#1c1c1c",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 8px", height: 36, flexShrink: 0,
        borderBottom: "1px solid #252525",
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: "#555",
          textTransform: "uppercase", letterSpacing: ".08em",
        }}>
          Explorer
        </span>
        <div style={{ display: "flex", gap: 1 }}>
          <ActionIcon onClick={() => { setCreatingFile(true); setCreatingFolder(false); }} title="New File" testId="button-new-file">
            <FilePlus style={{ width: 13, height: 13 }} />
          </ActionIcon>
          <ActionIcon onClick={() => { setCreatingFolder(true); setCreatingFile(false); }} title="New Folder" testId="button-new-folder">
            <FolderPlus style={{ width: 13, height: 13 }} />
          </ActionIcon>
          <ActionIcon onClick={onClose} title="Close Explorer" testId="button-close-file-explorer">
            <X style={{ width: 13, height: 13 }} />
          </ActionIcon>
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: "5px 8px", flexShrink: 0, borderBottom: "1px solid #222" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "3px 8px", borderRadius: 4,
          background: "#141414", border: "1px solid #2a2a2a",
        }}>
          <Search style={{ width: 11, height: 11, color: "#444", flexShrink: 0 }} />
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
            data-testid="input-file-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex", padding: 0 }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Inline create input ── */}
      {(creatingFile || creatingFolder) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "3px 8px 4px", flexShrink: 0,
          borderBottom: "1px solid #222", background: "#1e1e1e",
          height: 28,
        }}>
          {creatingFile
            ? <FilePlus   style={{ width: 12, height: 12, color: "#60a5fa", flexShrink: 0 }} />
            : <FolderPlus style={{ width: 12, height: 12, color: "#e8a427", flexShrink: 0 }} />}
          <InlineInput
            initialValue={creatingFile ? "untitled.tsx" : "new-folder"}
            onConfirm={creatingFile ? handleNewFile : handleNewFolder}
            onCancel={() => { setCreatingFile(false); setCreatingFolder(false); }}
          />
        </div>
      )}

      {/* ── Tree / Search results / Empty state ── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "2px 0",
        scrollbarWidth: "thin", scrollbarColor: "#2e2e2e transparent",
      }}>
        {sq ? (
          /* ── Search results ── */
          searchResults.length > 0 ? (
            searchResults.map(({ node, path }) => (
              <button key={node.id} onClick={() => handleSelect(node)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, width: "100%",
                  padding: "4px 10px", background: activeFileName === node.name ? "#2a2a2a" : "transparent",
                  border: "none", cursor: "pointer", textAlign: "left",
                  borderLeft: activeFileName === node.name ? "2px solid #3b82f6" : "2px solid transparent",
                  transition: "background .1s", fontFamily: "inherit",
                }}
                onMouseEnter={e => { if (activeFileName !== node.name) (e.currentTarget as HTMLElement).style.background = "#252525"; }}
                onMouseLeave={e => { if (activeFileName !== node.name) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                data-testid={`search-result-${node.name}`}>
                {fileIcon(node.name, "file")}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    color: activeFileName === node.name ? "#f0f0f0" : "#c4c4c4",
                  }}>
                    {node.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#484848", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {path.split("/").slice(0, -1).join("/") || "/"}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: "20px 12px", color: "#383838", fontSize: 11, textAlign: "center" }}>
              No results for "{searchQuery}"
            </div>
          )
        ) : isEmpty ? (
          /* ── Empty state — Replit style ── */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "28px 16px 20px", gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#222", border: "1px solid #2a2a2a",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FolderPlus style={{ width: 16, height: 16, color: "#444" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#555", fontWeight: 500, marginBottom: 4 }}>No files yet</div>
              <div style={{ fontSize: 11, color: "#3a3a3a", lineHeight: 1.5 }}>
                Create a file or folder<br />to get started
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              <button
                onClick={() => setCreatingFile(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                  background: "#222", border: "1px solid #2e2e2e",
                  color: "#888", fontSize: 11, fontFamily: "inherit",
                  transition: "all .1s",
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#c4c4c4"; el.style.borderColor = "#3a3a3a"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#222"; el.style.color = "#888"; el.style.borderColor = "#2e2e2e"; }}
                data-testid="button-empty-new-file"
              >
                <FilePlus style={{ width: 11, height: 11 }} /> New file
              </button>
              <button
                onClick={() => setCreatingFolder(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                  background: "#222", border: "1px solid #2e2e2e",
                  color: "#888", fontSize: 11, fontFamily: "inherit",
                  transition: "all .1s",
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#c4c4c4"; el.style.borderColor = "#3a3a3a"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#222"; el.style.color = "#888"; el.style.borderColor = "#2e2e2e"; }}
                data-testid="button-empty-new-folder"
              >
                <FolderPlus style={{ width: 11, height: 11 }} /> New folder
              </button>
            </div>
          </div>
        ) : (
          /* ── File tree ── */
          tree.map((node) => (
            <TreeNode
              key={node.id} node={node} depth={0}
              activeFileName={activeFileName}
              onSelect={handleSelect}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))
        )}
      </div>
    </div>
  );
}
