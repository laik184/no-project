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
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "rgba(10,12,22,0.97)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "rgba(148,163,184,0.4)" }}>Explorer</span>
        <div className="flex items-center gap-0.5">
          <ActionIcon onClick={() => setCreatingFile(true)}   title="New File"   testId="button-new-file">
            <FilePlus style={{ width: 12, height: 12 }} />
          </ActionIcon>
          <ActionIcon onClick={() => setCreatingFolder(true)} title="New Folder" testId="button-new-folder">
            <FolderPlus style={{ width: 12, height: 12 }} />
          </ActionIcon>
          <ActionIcon onClick={onClose} title="Close Explorer" testId="button-close-file-explorer">
            <X style={{ width: 12, height: 12 }} />
          </ActionIcon>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <Search style={{ width: 11, height: 11, color: "rgba(148,163,184,0.4)", flexShrink: 0 }} />
          <input
            ref={searchRef} value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            className="flex-1 bg-transparent outline-none text-[11.5px]"
            style={{ color: "rgba(226,232,240,0.8)", caretColor: "rgba(124,141,255,0.9)" }}
            data-testid="input-file-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ color: "rgba(148,163,184,0.4)" }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>
      </div>

      {/* Inline create inputs */}
      {(creatingFile || creatingFolder) && (
        <div className="px-3 py-1.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            {creatingFile
              ? <FilePlus   style={{ width: 12, height: 12, color: "#60a5fa", flexShrink: 0 }} />
              : <FolderPlus style={{ width: 12, height: 12, color: "#7c8dff", flexShrink: 0 }} />}
            <InlineInput
              initialValue={creatingFile ? "newfile.tsx" : "new-folder"}
              onConfirm={creatingFile ? handleNewFile : handleNewFolder}
              onCancel={() => { setCreatingFile(false); setCreatingFolder(false); }}
            />
          </div>
        </div>
      )}

      {/* Tree / Search results */}
      <div className="flex-1 overflow-y-auto py-1 px-1"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {sq ? (
          searchResults.length > 0 ? (
            searchResults.map(({ node, path }) => (
              <button key={node.id} onClick={() => handleSelect(node)}
                className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                style={{ background: activeFileName === node.name ? "rgba(124,141,255,0.12)" : undefined }}
                data-testid={`search-result-${node.name}`}>
                {fileIcon(node.name, "file")}
                <div className="min-w-0">
                  <p className="text-[11.5px] truncate"
                    style={{ color: activeFileName === node.name ? "rgba(226,232,240,0.95)" : "rgba(203,213,225,0.75)" }}>
                    {node.name}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: "rgba(100,116,139,0.55)" }}>
                    {path.split("/").slice(0, -1).join("/")}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="flex items-center justify-center py-6">
              <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.3)" }}>No files found</span>
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
