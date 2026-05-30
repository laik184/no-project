import { useState, useRef } from "react";
import { Search, X, FilePlus, FolderPlus } from "lucide-react";
import { FileNode } from "./types";
import { guessLang, fileIcon } from "./file-icon";
import {
  makeInitialTree, flattenFiles,
  deleteNodeById, renameNodeById, addNodeToRoot, uid,
} from "./tree-helpers";
import { TreeNode } from "./TreeNode";
import { ActionIcon, InlineInput } from "./InlineInput";

interface FileTreePanelProps {
  onFileOpen: (name: string, content: string, lang: string) => void;
  onClose: () => void;
  activeFileName?: string;
}

export function FileTreePanel({ onFileOpen, onClose, activeFileName = "" }: FileTreePanelProps) {
  const [tree, setTree]                   = useState<FileNode[]>(makeInitialTree);
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

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
      background: "#1c1c1c",
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 8px", height: 36, flexShrink: 0,
        borderBottom: "1px solid #2a2a2a",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".08em" }}>
          Explorer
        </span>
        <div style={{ display: "flex", gap: 2 }}>
          <ActionIcon onClick={() => setCreatingFile(true)}   title="New File"   testId="button-new-file">
            <FilePlus style={{ width: 13, height: 13 }} />
          </ActionIcon>
          <ActionIcon onClick={() => setCreatingFolder(true)} title="New Folder" testId="button-new-folder">
            <FolderPlus style={{ width: 13, height: 13 }} />
          </ActionIcon>
          <ActionIcon onClick={onClose} title="Close Explorer" testId="button-close-file-explorer">
            <X style={{ width: 13, height: 13 }} />
          </ActionIcon>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "6px 8px", flexShrink: 0, borderBottom: "1px solid #242424" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 8px", borderRadius: 5,
          background: "#141414", border: "1px solid #2e2e2e",
        }}>
          <Search style={{ width: 11, height: 11, color: "#444", flexShrink: 0 }} />
          <input
            ref={searchRef} value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 12, color: "#c4c4c4", caretColor: "#3b82f6",
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

      {/* Inline create input */}
      {(creatingFile || creatingFolder) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 8px", flexShrink: 0,
          borderBottom: "1px solid #242424", background: "#1e1e1e",
        }}>
          {creatingFile
            ? <FilePlus   style={{ width: 12, height: 12, color: "#60a5fa", flexShrink: 0 }} />
            : <FolderPlus style={{ width: 12, height: 12, color: "#e8a427", flexShrink: 0 }} />}
          <InlineInput
            initialValue={creatingFile ? "newfile.tsx" : "new-folder"}
            onConfirm={creatingFile ? handleNewFile : handleNewFolder}
            onCancel={() => { setCreatingFile(false); setCreatingFolder(false); }}
          />
        </div>
      )}

      {/* Tree / Search results */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "4px 0",
        scrollbarWidth: "thin", scrollbarColor: "#333 transparent",
      }}>
        {sq ? (
          searchResults.length > 0 ? (
            searchResults.map(({ node, path }) => (
              <button key={node.id} onClick={() => handleSelect(node)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, width: "100%",
                  padding: "4px 10px", background: activeFileName === node.name ? "#2a2a2a" : "transparent",
                  border: "none", cursor: "pointer", textAlign: "left",
                  borderLeft: activeFileName === node.name ? "2px solid #3b82f6" : "2px solid transparent",
                  transition: "background .1s",
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
                  <div style={{ fontSize: 10, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {path.split("/").slice(0, -1).join("/")}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: "20px 12px", color: "#3a3a3a", fontSize: 11, textAlign: "center" }}>
              No results for "{searchQuery}"
            </div>
          )
        ) : (
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
