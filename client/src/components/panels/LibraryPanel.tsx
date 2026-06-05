import { useState, useRef, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Plus, Upload, Folder, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FileNode,
  OpenFile,
  ContextMenu,
  DEFAULT_TREE,
  detectLanguage,
  findNode,
  removeNode,
  insertNode,
  updateNodeContent,
  renameNode,
  getNodePath,
  searchAllFiles,
} from "./library-panel-data";
import { TreeNode } from "./LibraryTreeNode";
import { LibraryQuickOpen } from "./library-quick-open";
import { LibraryContextMenu } from "./library-context-menu";

export function LibraryPanel() {
  const [tree, setTree] = useState<FileNode[]>(DEFAULT_TREE);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["src", "styles"]));
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeEditorId, setActiveEditorId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [quickOpenIdx, setQuickOpenIdx] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickOpenInputRef = useRef<HTMLInputElement>(null);

  const searchResults = showSearch && searchQuery.trim() ? searchAllFiles(tree, searchQuery) : [];

  function getAllFiles(nodes: FileNode[]): FileNode[] {
    const files: FileNode[] = [];
    const traverse = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.type === "file") files.push(n);
        if (n.children) traverse(n.children);
      }
    };
    traverse(nodes);
    return files;
  }

  const allFiles = getAllFiles(tree);
  const quickOpenResults = quickOpenQuery.trim()
    ? allFiles.filter((f) => f.name.toLowerCase().includes(quickOpenQuery.toLowerCase()))
    : allFiles;

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeEditorId) saveFile(activeEditorId);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        createFile(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "p") {
        e.preventDefault();
        setShowQuickOpen((prev) => !prev);
        setQuickOpenQuery("");
        setQuickOpenIdx(0);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
        return;
      }
      if (e.key === "Escape") {
        if (showQuickOpen) { setShowQuickOpen(false); setQuickOpenQuery(""); return; }
        if (showSearch) { setShowSearch(false); setSearchQuery(""); return; }
      }
      if (isTyping) return;
      if (e.key === "F2" && activeFileId) { e.preventDefault(); setRenamingId(activeFileId); return; }
      if (e.key === "Delete" && activeFileId) { e.preventDefault(); deleteNode(activeFileId); return; }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeEditorId, activeFileId, openFiles, showSearch, showQuickOpen]);

  useEffect(() => {
    if (showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [showSearch]);

  useEffect(() => {
    if (showQuickOpen) setTimeout(() => quickOpenInputRef.current?.focus(), 50);
  }, [showQuickOpen]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openFile = (node: FileNode) => {
    setActiveFileId(node.id);
    const already = openFiles.find((f) => f.id === node.id);
    if (already) { setActiveEditorId(node.id); return; }
    const newFile: OpenFile = {
      id: node.id, name: node.name, content: node.content || "",
      language: node.language || detectLanguage(node.name), isDirty: false,
    };
    setOpenFiles((prev) => [...prev, newFile]);
    setActiveEditorId(node.id);
  };

  const closeTab = (id: string) => {
    setOpenFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      const next = prev.filter((f) => f.id !== id);
      if (activeEditorId === id) {
        const newActive = next[idx - 1] || next[0] || null;
        setActiveEditorId(newActive?.id || null);
        setActiveFileId(newActive?.id || null);
      }
      return next;
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (!activeEditorId) return;
    setOpenFiles((prev) =>
      prev.map((f) => f.id === activeEditorId ? { ...f, content: value || "", isDirty: true } : f)
    );
  };

  const saveFile = (id: string) => {
    const file = openFiles.find((f) => f.id === id);
    if (!file) return;
    setTree((prev) => updateNodeContent(prev, id, file.content));
    setOpenFiles((prev) => prev.map((f) => f.id === id ? { ...f, isDirty: false } : f));
  };

  const handleContextMenu = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  };

  const createFile = (parentId: string | null) => {
    const id = `file-${Date.now()}`;
    const newNode: FileNode = { id, name: "untitled.js", type: "file", language: "javascript", content: "" };
    if (parentId) {
      setTree((prev) => insertNode(prev, parentId, newNode));
      setExpandedIds((prev) => new Set([...prev, parentId]));
    } else {
      setTree((prev) => [...prev, newNode]);
    }
    setTimeout(() => setRenamingId(id), 100);
    setContextMenu(null);
  };

  const createFolder = (parentId: string | null) => {
    const id = `folder-${Date.now()}`;
    const newNode: FileNode = { id, name: "new-folder", type: "folder", children: [] };
    if (parentId) {
      setTree((prev) => insertNode(prev, parentId, newNode));
      setExpandedIds((prev) => new Set([...prev, parentId]));
    } else {
      setTree((prev) => [...prev, newNode]);
    }
    setTimeout(() => setRenamingId(id), 100);
    setContextMenu(null);
  };

  const deleteNode = (id: string) => {
    setTree((prev) => removeNode(prev, id));
    setOpenFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeEditorId === id) setActiveEditorId(null);
    if (activeFileId === id) setActiveFileId(null);
    setContextMenu(null);
  };

  const handleRenameSubmit = (id: string, newName: string) => {
    if (newName.trim()) {
      setTree((prev) => renameNode(prev, id, newName.trim()));
      setOpenFiles((prev) => prev.map((f) => f.id === id ? { ...f, name: newName.trim(), language: detectLanguage(newName.trim()) } : f));
    }
    setRenamingId(null);
  };

  const handleDragStart = (id: string) => setDragNodeId(id);

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDrop = (targetId: string) => {
    if (!dragNodeId || dragNodeId === targetId) { setDragOverId(null); return; }
    const target = findNode(tree, targetId);
    if (target?.type !== "folder") { setDragOverId(null); return; }
    const draggedNode = findNode(tree, dragNodeId);
    if (!draggedNode) { setDragOverId(null); return; }
    setTree((prev) => {
      const removed = removeNode(prev, dragNodeId);
      return insertNode(removed, targetId, draggedNode);
    });
    setExpandedIds((prev) => new Set([...prev, targetId]));
    setDragNodeId(null);
    setDragOverId(null);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const id = `upload-${Date.now()}`;
      const newNode: FileNode = {
        id, name: file.name, type: "file",
        language: detectLanguage(file.name),
        content: ev.target?.result as string,
      };
      setTree((prev) => [...prev, newNode]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDownload = (id: string) => {
    const node = findNode(tree, id);
    if (!node || node.type !== "file") return;
    const file = openFiles.find((f) => f.id === id);
    const content = file?.content ?? node.content ?? "";
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = node.name; a.click();
    URL.revokeObjectURL(url);
    setContextMenu(null);
  };

  const copyPath = (id: string) => {
    const path = getNodePath(tree, id);
    if (path) navigator.clipboard.writeText(path);
    setContextMenu(null);
  };

  const activeFile = openFiles.find((f) => f.id === activeEditorId);
  const contextNode = contextMenu ? findNode(tree, contextMenu.nodeId || "") : null;

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden" style={{ background: "rgba(10,12,20,0.98)" }}>
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <Panel defaultSize={25} minSize={15} maxSize={45}>
          <div className="flex flex-col h-full border-r" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div
              className="flex items-center justify-between px-3 py-2 flex-shrink-0 border-b"
              style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.5)" }}>
                {showSearch ? "Search" : "Explorer"}
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); }}
                  className={cn(
                    "w-5 h-5 flex items-center justify-center rounded transition-colors",
                    showSearch ? "bg-primary/20 text-primary" : "hover:bg-white/8 text-muted-foreground hover:text-foreground"
                  )}
                  title="Search (Ctrl+Shift+F)"
                  data-testid="button-search-toggle"
                >
                  <Search className="h-3 w-3" />
                </button>
                {!showSearch && (
                  <>
                    <button onClick={() => createFile(null)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors" title="New File" data-testid="button-new-file">
                      <Plus className="h-3 w-3" />
                    </button>
                    <button onClick={() => createFolder(null)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors" title="New Folder" data-testid="button-new-folder">
                      <Folder className="h-3 w-3" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors" title="Upload File" data-testid="button-upload-file-explorer">
                      <Upload className="h-3 w-3" />
                    </button>
                  </>
                )}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
              </div>
            </div>

            {showSearch ? (
              <LibrarySearchPane
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                searchResults={searchResults}
                tree={tree}
                openFile={openFile}
                setShowSearch={setShowSearch}
                searchInputRef={searchInputRef}
              />
            ) : (
              <div className="flex-1 overflow-y-auto py-1 px-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, nodeId: null }); }}>
                {tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    depth={0}
                    expandedIds={expandedIds}
                    activeFileId={activeFileId}
                    renamingId={renamingId}
                    dragOverId={dragOverId}
                    onToggle={toggleExpand}
                    onFileClick={openFile}
                    onContextMenu={handleContextMenu}
                    onRenameSubmit={handleRenameSubmit}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="w-[3px] hover:bg-primary/40 transition-colors cursor-col-resize" style={{ background: "rgba(255,255,255,0.06)" }} />

        <Panel defaultSize={75} minSize={40}>
          <div className="flex flex-col h-full overflow-hidden">
            <LibraryEditorPane
              openFiles={openFiles}
              activeEditorId={activeEditorId}
              activeFile={activeFile}
              onSelectTab={(id) => { setActiveEditorId(id); setActiveFileId(id); }}
              onCloseTab={closeTab}
              onEditorChange={handleEditorChange}
              onSaveFile={saveFile}
            />
          </div>
        </Panel>
      </PanelGroup>

      <LibraryQuickOpen
        showQuickOpen={showQuickOpen}
        quickOpenQuery={quickOpenQuery}
        setQuickOpenQuery={setQuickOpenQuery}
        quickOpenIdx={quickOpenIdx}
        setQuickOpenIdx={setQuickOpenIdx}
        quickOpenResults={quickOpenResults}
        tree={tree}
        inputRef={quickOpenInputRef}
        onOpen={openFile}
        onClose={() => setShowQuickOpen(false)}
      />

      <LibraryContextMenu
        contextMenu={contextMenu}
        contextMenuRef={contextMenuRef}
        contextNode={contextNode}
        onRename={(id) => setRenamingId(id)}
        onCreateFile={createFile}
        onCreateFolder={createFolder}
        onCopyPath={copyPath}
        onDownload={handleDownload}
        onDelete={deleteNode}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
}
