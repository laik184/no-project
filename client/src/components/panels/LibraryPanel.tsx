import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Plus,
  Trash2,
  Download,
  Upload,
  X,
  Save,
  FileCode,
  Circle,
  FilePlus,
  FolderPlus,
  Clipboard,
  Search,
  Edit3,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FileNode,
  OpenFile,
  ContextMenu,
  SearchResult,
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
import { TreeNode, getLanguageIcon } from "./LibraryTreeNode";

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
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-2 py-2 border-b flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <Search className="h-3 w-3 flex-shrink-0" style={{ color: "rgba(148,163,184,0.5)" }} />
                    <input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search in files..." className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none min-w-0" data-testid="input-global-search" />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <p className="text-[10px] mt-1.5" style={{ color: "rgba(148,163,184,0.4)" }}>
                      {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
                  {!searchQuery.trim() ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: "rgba(100,116,139,0.45)" }}>
                      <Search className="h-6 w-6" style={{ color: "rgba(100,116,139,0.25)" }} />
                      <p className="text-[11px] text-center px-4">Type to search across all files</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: "rgba(100,116,139,0.45)" }}>
                      <p className="text-[11px]">No results found</p>
                    </div>
                  ) : (
                    <div className="py-1">
                      {(() => {
                        const grouped = searchResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
                          if (!acc[r.fileId]) acc[r.fileId] = [];
                          acc[r.fileId].push(r);
                          return acc;
                        }, {});
                        return Object.entries(grouped).map(([fileId, results]) => (
                          <div key={fileId}>
                            <div className="flex items-center gap-1.5 px-2 py-1 sticky top-0" style={{ background: "rgba(10,12,20,0.98)" }}>
                              {getLanguageIcon(results[0].fileName)}
                              <span className="text-[10px] font-semibold truncate" style={{ color: "rgba(226,232,240,0.6)" }}>{results[0].fileName}</span>
                              <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: "rgba(100,116,139,0.5)" }}>{results.length}</span>
                            </div>
                            {results.map((result, i) => {
                              const before = result.lineText.slice(0, result.matchIndex);
                              const match = result.lineText.slice(result.matchIndex, result.matchIndex + searchQuery.length);
                              const after = result.lineText.slice(result.matchIndex + searchQuery.length);
                              return (
                                <button key={i} onClick={() => { const node = findNode(tree, fileId); if (node) openFile(node); setShowSearch(false); }} className="w-full text-left flex items-start gap-2 px-2 py-1 hover:bg-white/5 transition-colors group" data-testid={`search-result-${fileId}-${i}`}>
                                  <span className="text-[10px] flex-shrink-0 mt-px font-mono" style={{ color: "rgba(100,116,139,0.4)", minWidth: 24, textAlign: "right" }}>{result.lineNumber}</span>
                                  <span className="text-[11px] font-mono truncate" style={{ color: "rgba(148,163,184,0.65)" }}>
                                    <span>{before}</span>
                                    <span style={{ color: "#f59e0b", background: "rgba(245,158,11,0.15)", borderRadius: 2, padding: "0 1px" }}>{match}</span>
                                    <span>{after}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
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
            {openFiles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: "rgba(100,116,139,0.5)" }}>
                <FileCode className="h-10 w-10" style={{ color: "rgba(100,116,139,0.3)" }} />
                <p className="text-sm">Click a file to open it in the editor</p>
                <p className="text-xs" style={{ color: "rgba(100,116,139,0.35)" }}>or right-click to create a new file</p>
              </div>
            ) : (
              <>
                <div className="flex items-center border-b overflow-x-auto flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", scrollbarWidth: "none" }}>
                  {openFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => { setActiveEditorId(file.id); setActiveFileId(file.id); }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 border-r cursor-pointer flex-shrink-0 transition-all group text-xs",
                        activeEditorId === file.id
                          ? "bg-white/6 text-foreground border-b-2 border-b-primary"
                          : "text-muted-foreground hover:bg-white/4 hover:text-foreground"
                      )}
                      style={{ borderRightColor: "rgba(255,255,255,0.06)" }}
                      data-testid={`editor-tab-${file.id}`}
                    >
                      {getLanguageIcon(file.name)}
                      <span className="whitespace-nowrap max-w-[120px] truncate">{file.name}</span>
                      {file.isDirty && <Circle className="h-1.5 w-1.5 fill-current text-primary flex-shrink-0" />}
                      <button onClick={(e) => { e.stopPropagation(); closeTab(file.id); }} className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white/12 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0" data-testid={`button-close-editor-tab-${file.id}`}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {activeFile && (
                  <div className="flex items-center justify-between px-3 py-1 border-b flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
                    <div className="flex items-center gap-1.5">
                      {getLanguageIcon(activeFile.name)}
                      <span className="text-xs text-foreground/60">{activeFile.name}</span>
                      {activeFile.isDirty && <span className="text-[10px] text-primary/70">● unsaved</span>}
                    </div>
                    <button
                      onClick={() => saveFile(activeFile.id)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all",
                        activeFile.isDirty
                          ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20"
                          : "text-muted-foreground/40 cursor-default"
                      )}
                      disabled={!activeFile.isDirty}
                      data-testid="button-save-file"
                    >
                      <Save className="h-3 w-3" />
                      Save
                    </button>
                  </div>
                )}

                <div className="flex-1 overflow-hidden">
                  {activeFile && (
                    <Editor
                      key={activeFile.id}
                      height="100%"
                      language={activeFile.language}
                      value={activeFile.content}
                      onChange={handleEditorChange}
                      theme="vs-dark"
                      options={{
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        lineNumbers: "on",
                        renderLineHighlight: "line",
                        wordWrap: "on",
                        automaticLayout: true,
                        formatOnType: true,
                        tabSize: 2,
                        insertSpaces: true,
                        bracketPairColorization: { enabled: true },
                        renderWhitespace: "none",
                        cursorBlinking: "smooth",
                        smoothScrolling: true,
                        padding: { top: 12, bottom: 12 },
                        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {showQuickOpen && (
        <div className="absolute inset-0 z-50 flex flex-col items-center pt-12 px-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={() => { setShowQuickOpen(false); setQuickOpenQuery(""); }}>
          <div className="w-full rounded-xl overflow-hidden flex flex-col" style={{ maxWidth: 480, maxHeight: 360, background: "rgba(13,14,26,0.99)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <Search className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "rgba(148,163,184,0.5)" }} />
              <input
                ref={quickOpenInputRef}
                value={quickOpenQuery}
                onChange={(e) => { setQuickOpenQuery(e.target.value); setQuickOpenIdx(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setQuickOpenIdx((i) => Math.min(i + 1, quickOpenResults.length - 1)); }
                  if (e.key === "ArrowUp") { e.preventDefault(); setQuickOpenIdx((i) => Math.max(i - 1, 0)); }
                  if (e.key === "Enter" && quickOpenResults[quickOpenIdx]) { openFile(quickOpenResults[quickOpenIdx]); setShowQuickOpen(false); setQuickOpenQuery(""); }
                  if (e.key === "Escape") { setShowQuickOpen(false); setQuickOpenQuery(""); }
                }}
                placeholder="Search files by name..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                data-testid="input-quick-open"
              />
              <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(148,163,184,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>ESC</kbd>
            </div>

            <div className="overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
              {quickOpenResults.length === 0 ? (
                <div className="py-8 text-center text-xs" style={{ color: "rgba(100,116,139,0.5)" }}>No files found</div>
              ) : (
                quickOpenResults.map((file, idx) => {
                  const isSelected = idx === quickOpenIdx;
                  const path = getNodePath(tree, file.id) || file.name;
                  const qLower = quickOpenQuery.toLowerCase();
                  const nameLower = file.name.toLowerCase();
                  const matchIdx = nameLower.indexOf(qLower);
                  return (
                    <button key={file.id} onClick={() => { openFile(file); setShowQuickOpen(false); setQuickOpenQuery(""); }} onMouseEnter={() => setQuickOpenIdx(idx)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors" style={{ background: isSelected ? "rgba(124,141,255,0.12)" : "transparent" }} data-testid={`quickopen-result-${file.id}`}>
                      {getLanguageIcon(file.name)}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs truncate" style={{ color: isSelected ? "rgba(226,232,240,1)" : "rgba(226,232,240,0.75)" }}>
                          {matchIdx >= 0 && quickOpenQuery ? (
                            <>
                              <span>{file.name.slice(0, matchIdx)}</span>
                              <span style={{ color: "#f59e0b", fontWeight: 600 }}>{file.name.slice(matchIdx, matchIdx + quickOpenQuery.length)}</span>
                              <span>{file.name.slice(matchIdx + quickOpenQuery.length)}</span>
                            </>
                          ) : file.name}
                        </span>
                        <span className="text-[10px] truncate" style={{ color: "rgba(100,116,139,0.5)" }}>{path}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-3 px-3 py-1.5 border-t flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
              {[["↑↓", "navigate"], ["↵", "open"], ["ESC", "close"]].map(([key, label]) => (
                <span key={key} className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(100,116,139,0.5)" }}>
                  <kbd className="px-1 py-px rounded font-mono" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}>{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 py-1.5 rounded-xl overflow-hidden"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - 260), width: 192, background: "rgba(13,13,28,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.nodeId ? (
            <>
              <ContextMenuItem icon={<Edit3 className="h-3.5 w-3.5" />} label="Rename" onClick={() => { setRenamingId(contextMenu.nodeId); setContextMenu(null); }} />
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 8px" }} />
              {contextNode?.type === "folder" && (
                <>
                  <ContextMenuItem icon={<FilePlus className="h-3.5 w-3.5" />} label="Add File" onClick={() => createFile(contextMenu.nodeId)} />
                  <ContextMenuItem icon={<FolderPlus className="h-3.5 w-3.5" />} label="Add Folder" onClick={() => createFolder(contextMenu.nodeId)} />
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 8px" }} />
                </>
              )}
              <ContextMenuItem icon={<Clipboard className="h-3.5 w-3.5" />} label="Copy Path" onClick={() => copyPath(contextMenu.nodeId!)} />
              {contextNode?.type === "file" && (
                <ContextMenuItem icon={<Download className="h-3.5 w-3.5" />} label="Download" onClick={() => handleDownload(contextMenu.nodeId!)} />
              )}
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 8px" }} />
              <ContextMenuItem icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />} label="Delete" labelClass="text-red-400" onClick={() => deleteNode(contextMenu.nodeId!)} />
            </>
          ) : (
            <>
              <ContextMenuItem icon={<FilePlus className="h-3.5 w-3.5" />} label="New File" onClick={() => createFile(null)} />
              <ContextMenuItem icon={<FolderPlus className="h-3.5 w-3.5" />} label="New Folder" onClick={() => createFolder(null)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ContextMenuItem({ icon, label, labelClass, onClick }: { icon: React.ReactNode; label: string; labelClass?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs hover:bg-white/6 transition-colors text-left" style={{ color: "rgba(226,232,240,0.75)" }}>
      <span className="text-muted-foreground">{icon}</span>
      <span className={labelClass}>{label}</span>
    </button>
  );
}
