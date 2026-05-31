import { useState, useRef, useEffect } from "react";
import {
  Search, X, FilePlus, FolderPlus, MoreHorizontal,
  FolderUp, Download, Eye, EyeOff, ChevronsUpDown, FolderOpen,
} from "lucide-react";
import JSZip from "jszip";
import { FileNode } from "./types";
import { guessLang, fileIcon } from "./file-icon";
import {
  flattenFiles, deleteNodeById, renameNodeById, addNodeToRoot,
  addNodeInsideFolder, uid, moveNode, getDescendantIds,
  duplicateName,
} from "./tree-helpers";
import { TreeNode } from "./TreeNode";
import { ActionIcon, InlineInput } from "./InlineInput";
import { useGitStatus } from "./use-git-status";

interface FileTreePanelProps {
  onFileOpen: (name: string, content: string, lang: string) => void;
  onClose: () => void;
  activeFileName?: string;
}

function MenuDivider() {
  return <div style={{ height: 1, background: "#272727", margin: "3px 0" }} />;
}

function MenuItem({
  Icon, label, onClick, active, testId,
}: {
  Icon: React.ElementType; label: string; onClick: () => void; active?: boolean; testId?: string;
}) {
  return (
    <button
      role="menuitem" onClick={onClick} data-testid={testId}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        width: "100%", padding: "6px 14px",
        background: "transparent", border: "none", cursor: "pointer",
        color: active ? "#60a5fa" : "#aaaaaa",
        fontSize: 13, fontFamily: "inherit", textAlign: "left",
        transition: "background .1s, color .1s",
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#272727"; el.style.color = active ? "#93c5fd" : "#e0e0e0"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "transparent"; el.style.color = active ? "#60a5fa" : "#aaaaaa"; }}
    >
      <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
      {label}
    </button>
  );
}

function buildTreeFromFiles(items: { path: string; content: string }[]): FileNode[] {
  const root: FileNode[] = [];
  for (const { path, content } of items) {
    const parts = path.split("/").filter(Boolean);
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let folder = cursor.find((n) => n.type === "folder" && n.name === part);
      if (!folder) {
        folder = { id: uid(), name: part, type: "folder", children: [] };
        cursor.push(folder);
      }
      cursor = folder.children!;
    }
    const fileName = parts[parts.length - 1];
    if (fileName) cursor.push({ id: uid(), name: fileName, type: "file", lang: guessLang(fileName), content });
  }
  return root;
}

function flattenVisibleIds(nodes: FileNode[], expandedIds: Set<string>): string[] {
  const result: string[] = [];
  const walk = (list: FileNode[]) => {
    for (const node of list) {
      result.push(node.id);
      if (node.type === "folder" && expandedIds.has(node.id) && node.children) walk(node.children);
    }
  };
  walk(nodes);
  return result;
}

export function FileTreePanel({ onFileOpen, onClose, activeFileName = "" }: FileTreePanelProps) {
  const [tree, setTree]                     = useState<FileNode[]>([]);
  const [searchQuery, setSearchQuery]       = useState("");
  const [creatingFile, setCreatingFile]     = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [showMenu, setShowMenu]             = useState(false);
  const [showHidden, setShowHidden]         = useState(false);
  const [collapseRevision, setCollapseRevision] = useState(0);
  // P1 — keyboard nav
  const [focusedId, setFocusedId]           = useState<string | undefined>(undefined);
  const expandedIdsRef                      = useRef<Set<string>>(new Set());
  // P2 — multi-select
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const lastSelectedIdRef                   = useRef<string | null>(null);
  // P2 — drag & drop
  const [dragSourceId, setDragSourceId]     = useState<string | null>(null);
  const [dropTargetId, setDropTargetId]     = useState<string | null>(null);

  const { statusMap: gitStatusMap }         = useGitStatus();

  const searchRef  = useRef<HTMLInputElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);
  const uploadRef  = useRef<HTMLInputElement>(null);
  const treeRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, expanded } = (e as CustomEvent).detail ?? {};
      if (!id) return;
      if (expanded) expandedIdsRef.current.add(id);
      else expandedIdsRef.current.delete(id);
    };
    window.addEventListener("rfe:treepanel-set-expanded", handler);
    return () => window.removeEventListener("rfe:treepanel-set-expanded", handler);
  }, []);

  const sq = searchQuery.trim().toLowerCase();
  const searchResults = sq ? flattenFiles(tree).filter(({ path }) => path.toLowerCase().includes(sq)) : [];

  // ── Core handlers ────────────────────────────────────────────────────────
  const handleSelect    = (node: FileNode) => {
    if (node.type === "file") onFileOpen(node.name, node.content ?? "", node.lang ?? guessLang(node.name));
  };
  const handleDelete    = (id: string) => setTree(p => deleteNodeById(p, id));
  const handleRename    = (id: string, name: string) => setTree(p => renameNodeById(p, id, name));

  const handleCreateInside = (type: "file" | "folder", name: string, parentId: string) => {
    const newNode: FileNode = type === "file"
      ? { id: uid(), name, type: "file", lang: guessLang(name), content: "" }
      : { id: uid(), name, type: "folder", children: [] };
    setTree(p => addNodeInsideFolder(p, parentId, newNode));
    if (type === "file") onFileOpen(name, "", guessLang(name));
  };

  const handleNewFile   = (name: string) => {
    setTree(p => addNodeToRoot(p, { id: uid(), name, type: "file", lang: guessLang(name), content: "" }));
    setCreatingFile(false);
    onFileOpen(name, "", guessLang(name));
  };
  const handleNewFolder = (name: string) => {
    setTree(p => addNodeToRoot(p, { id: uid(), name, type: "folder", children: [] }));
    setCreatingFolder(false);
  };

  // P2 — multi-select: ctrl/cmd = toggle, shift = range, plain = clear
  const handleMultiSelect = (id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else if (e.shiftKey && lastSelectedIdRef.current) {
      const visible = flattenVisibleIds(
        showHidden ? tree : tree.filter(n => !n.name.startsWith(".")),
        expandedIdsRef.current,
      );
      const a = visible.indexOf(lastSelectedIdRef.current);
      const b = visible.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        setSelectedIds(new Set(visible.slice(lo, hi + 1)));
      }
    } else {
      setSelectedIds(new Set());
    }
    lastSelectedIdRef.current = id;
  };

  // P2 — drag & drop
  const handleDragStart = (id: string, _isDir: boolean) => setDragSourceId(id);
  const handleDragEnter = (id: string) => setDropTargetId(id);
  const handleDragEnd   = () => { setDragSourceId(null); setDropTargetId(null); };

  const handleDrop = (sourceId: string, targetId: string) => {
    setDragSourceId(null);
    setDropTargetId(null);
    if (sourceId === targetId) return;
    const descendants = getDescendantIds(tree, sourceId);
    if (descendants.has(targetId)) return; // prevent circular nesting
    setTree(prev => moveNode(prev, sourceId, targetId));
  };

  // P2 — duplicate: creates a -copy sibling
  const handleDuplicate = (id: string) => {
    const findNode = (nodes: FileNode[]): FileNode | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if (n.children) { const f = findNode(n.children); if (f) return f; }
      }
    };
    const findSiblingNames = (nodes: FileNode[]): string[] | null => {
      if (nodes.some(n => n.id === id)) return nodes.map(n => n.name);
      for (const n of nodes) {
        if (n.children) { const r = findSiblingNames(n.children); if (r) return r; }
      }
      return null;
    };
    const src = findNode(tree);
    if (!src) return;
    const sibNames = findSiblingNames(tree) ?? [];
    const newName  = duplicateName(src.name, sibNames);
    const makeCopy = (node: FileNode, name: string): FileNode =>
      node.type === "file"
        ? { id: uid(), name, type: "file", lang: node.lang ?? guessLang(name), content: node.content ?? "" }
        : { id: uid(), name, type: "folder", children: (node.children ?? []).map(c => makeCopy(c, c.name)) };
    const copy = makeCopy(src, newName);
    const insertAfter = (nodes: FileNode[]): FileNode[] => {
      const out: FileNode[] = [];
      for (const n of nodes) {
        out.push(n.children ? { ...n, children: insertAfter(n.children) } : n);
        if (n.id === id) out.push(copy);
      }
      return out;
    };
    setTree(prev => insertAfter(prev));
  };

  const handleUploadFolder   = () => { uploadRef.current?.click(); setShowMenu(false); };
  const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const readText = (file: File): Promise<{ path: string; content: string }> =>
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload  = () => resolve({ path: file.webkitRelativePath || file.name, content: reader.result as string });
        reader.onerror = () => resolve({ path: file.webkitRelativePath || file.name, content: "" });
        reader.readAsText(file);
      });
    const items = await Promise.all(files.map(readText));
    setTree(prev => [...prev, ...buildTreeFromFiles(items)]);
    e.target.value = "";
  };

  const handleDownloadZip = async () => {
    setShowMenu(false);
    const zip = new JSZip();
    const addNodes = (nodes: FileNode[], prefix = "") => {
      for (const node of nodes) {
        const path = prefix ? `${prefix}/${node.name}` : node.name;
        if (node.type === "file")       zip.file(path, node.content ?? "");
        else if (node.children?.length) addNodes(node.children, path);
        else                            zip.folder(path);
      }
    };
    addNodes(tree);
    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "project.zip" }).click();
    URL.revokeObjectURL(url);
  };

  const handleToggleHidden = () => { setShowHidden(v => !v); setShowMenu(false); };
  const handleCollapseAll  = () => { setCollapseRevision(v => v + 1); setShowMenu(false); };
  const handleCloseFiles   = () => { setShowMenu(false); onClose(); };

  // P1 — keyboard navigation
  const handleTreeKeyDown = (e: React.KeyboardEvent) => {
    const visible = flattenVisibleIds(
      showHidden ? tree : tree.filter(n => !n.name.startsWith(".")),
      expandedIdsRef.current,
    );
    if (!visible.length) return;

    const curIdx = focusedId ? visible.indexOf(focusedId) : -1;

    const findNode = (id: string): FileNode | undefined => {
      const walk = (nodes: FileNode[]): FileNode | undefined => {
        for (const n of nodes) {
          if (n.id === id) return n;
          if (n.children) { const f = walk(n.children); if (f) return f; }
        }
      };
      return walk(tree);
    };

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextId = visible[Math.min(visible.length - 1, curIdx + 1)];
        if (nextId) { setFocusedId(nextId); treeRef.current?.querySelector(`[data-tree-node-id="${nextId}"]`)?.scrollIntoView({ block: "nearest" }); }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevId = visible[Math.max(0, curIdx - 1)];
        if (prevId) { setFocusedId(prevId); treeRef.current?.querySelector(`[data-tree-node-id="${prevId}"]`)?.scrollIntoView({ block: "nearest" }); }
        break;
      }
      case "ArrowRight": {
        e.preventDefault();
        if (focusedId) {
          const node = findNode(focusedId);
          if (node?.type === "folder" && !expandedIdsRef.current.has(focusedId)) {
            expandedIdsRef.current.add(focusedId);
            window.dispatchEvent(new CustomEvent("rfe:treepanel-set-expanded", { detail: { id: focusedId, expanded: true } }));
          }
        }
        break;
      }
      case "ArrowLeft": {
        e.preventDefault();
        if (focusedId) {
          const node = findNode(focusedId);
          if (node?.type === "folder" && expandedIdsRef.current.has(focusedId)) {
            expandedIdsRef.current.delete(focusedId);
            window.dispatchEvent(new CustomEvent("rfe:treepanel-set-expanded", { detail: { id: focusedId, expanded: false } }));
          }
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (focusedId) {
          const node = findNode(focusedId);
          if (!node) break;
          if (node.type === "folder") {
            const expanded = expandedIdsRef.current.has(focusedId);
            if (expanded) expandedIdsRef.current.delete(focusedId);
            else          expandedIdsRef.current.add(focusedId);
            window.dispatchEvent(new CustomEvent("rfe:treepanel-set-expanded", { detail: { id: focusedId, expanded: !expanded } }));
          } else { handleSelect(node); }
        }
        break;
      }
      case " ": {
        e.preventDefault();
        if (focusedId) { const node = findNode(focusedId); if (node) handleSelect(node); }
        break;
      }
      case "Home": {
        e.preventDefault();
        const firstId = visible[0];
        if (firstId) { setFocusedId(firstId); treeRef.current?.querySelector(`[data-tree-node-id="${firstId}"]`)?.scrollIntoView({ block: "nearest" }); }
        break;
      }
      case "End": {
        e.preventDefault();
        const lastId = visible[visible.length - 1];
        if (lastId) { setFocusedId(lastId); treeRef.current?.querySelector(`[data-tree-node-id="${lastId}"]`)?.scrollIntoView({ block: "nearest" }); }
        break;
      }
    }
  };

  const visibleTree = showHidden ? tree : tree.filter(n => !n.name.startsWith("."));
  const isEmpty     = visibleTree.length === 0 && !creatingFile && !creatingFolder;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", overflow: "hidden",
      background: "#1c1c1c", fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 8px", height: 36, flexShrink: 0, borderBottom: "1px solid #252525",
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: ".08em" }}>
          Explorer
        </span>
        <ActionIcon onClick={onClose} title="Close Explorer" testId="button-close-file-explorer">
          <X style={{ width: 13, height: 13 }} />
        </ActionIcon>
      </div>

      {/* ── Search + 3-dot menu ── */}
      <div style={{
        padding: "5px 6px 5px 8px", flexShrink: 0,
        borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: 4,
      }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 6,
          padding: "3px 8px", borderRadius: 4, background: "#141414", border: "1px solid #2a2a2a",
        }}>
          <Search style={{ width: 11, height: 11, color: "#444", flexShrink: 0 }} />
          <input
            ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#c4c4c4", caretColor: "#3b82f6", fontFamily: "inherit" }}
            data-testid="input-file-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#444", display: "flex", padding: 0 }}>
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>

        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setShowMenu(v => !v)}
            title="More actions"
            data-testid="button-explorer-more"
            aria-haspopup="menu"
            aria-expanded={showMenu}
            style={{
              width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
              background: showMenu ? "#2a2a2a" : "transparent",
              border: "none", cursor: "pointer", borderRadius: 4,
              color: showMenu ? "#c4c4c4" : "#4a4a4a", transition: "background .1s, color .1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#2a2a2a"; (e.currentTarget as HTMLElement).style.color = "#c4c4c4"; }}
            onMouseLeave={e => { if (!showMenu) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#4a4a4a"; } }}
          >
            <MoreHorizontal style={{ width: 15, height: 15 }} />
          </button>

          {showMenu && (
            <div role="menu" aria-label="Explorer actions" style={{
              position: "absolute", top: "calc(100% + 5px)", right: 0, zIndex: 200,
              background: "#1a1a1a", border: "1px solid #2e2e2e",
              borderRadius: 8, padding: "4px 0",
              boxShadow: "0 12px 32px rgba(0,0,0,.6)", minWidth: 160,
            }}>
              <MenuItem Icon={FilePlus}   label="New file"    testId="menu-new-file"
                onClick={() => { setCreatingFile(true); setCreatingFolder(false); setShowMenu(false); }} />
              <MenuItem Icon={FolderPlus} label="New folder"  testId="menu-new-folder"
                onClick={() => { setCreatingFolder(true); setCreatingFile(false); setShowMenu(false); }} />
              <MenuDivider />
              <MenuItem Icon={FolderUp}   label="Upload folder"   testId="menu-upload-folder" onClick={handleUploadFolder} />
              <MenuItem Icon={Download}   label="Download as zip"  testId="menu-download-zip"  onClick={handleDownloadZip} />
              <MenuDivider />
              <MenuItem Icon={showHidden ? EyeOff : Eye}
                label={showHidden ? "Hide hidden files" : "Show hidden files"}
                active={showHidden} testId="menu-toggle-hidden" onClick={handleToggleHidden} />
              <MenuItem Icon={ChevronsUpDown} label="Collapse all" testId="menu-collapse-all" onClick={handleCollapseAll} />
              <MenuDivider />
              <MenuItem Icon={FolderOpen} label="Close files" testId="menu-close-files" onClick={handleCloseFiles} />
            </div>
          )}
        </div>
      </div>

      <input
        ref={uploadRef} type="file" style={{ display: "none" }}
        onChange={handleFolderSelected}
        {...({ webkitdirectory: "", multiple: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
      />

      {(creatingFile || creatingFolder) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "3px 8px 4px", flexShrink: 0,
          borderBottom: "1px solid #222", background: "#1e1e1e", height: 28,
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

      <div
        ref={treeRef} role="tree" aria-label="File tree" tabIndex={0}
        style={{ flex: 1, overflowY: "auto", padding: "2px 0", outline: "none", scrollbarWidth: "thin", scrollbarColor: "#2e2e2e transparent" }}
        onKeyDown={handleTreeKeyDown}
      >
        {sq ? (
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
                data-testid={`search-result-${node.name}`}
              >
                {fileIcon(node.name, "file")}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: activeFileName === node.name ? "#f0f0f0" : "#c4c4c4" }}>
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 16px 20px", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#222", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FolderPlus style={{ width: 16, height: 16, color: "#444" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#555", fontWeight: 500, marginBottom: 4 }}>No files yet</div>
              <div style={{ fontSize: 11, color: "#3a3a3a", lineHeight: 1.5 }}>Create a file or folder<br />to get started</div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
              {[
                { label: "New file",   Icon: FilePlus,   onClick: () => setCreatingFile(true) },
                { label: "New folder", Icon: FolderPlus, onClick: () => setCreatingFolder(true) },
              ].map(({ label, Icon, onClick }) => (
                <button key={label} onClick={onClick}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 5, cursor: "pointer", background: "#222", border: "1px solid #2e2e2e", color: "#888", fontSize: 11, fontFamily: "inherit", transition: "all .1s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#2a2a2a"; el.style.color = "#c4c4c4"; el.style.borderColor = "#3a3a3a"; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#222"; el.style.color = "#888"; el.style.borderColor = "#2e2e2e"; }}
                >
                  <Icon style={{ width: 11, height: 11 }} /> {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          visibleTree.map((node) => (
            <TreeNode
              key={node.id} node={node} depth={0}
              activeFileName={activeFileName}
              onSelect={handleSelect} onDelete={handleDelete} onRename={handleRename}
              onCreateInside={handleCreateInside}
              collapseRevision={collapseRevision} showHidden={showHidden}
              focusedId={focusedId} onFocus={setFocusedId}
              isSelected={selectedIds.has(node.id)}
              onMultiSelect={handleMultiSelect}
              dragSourceId={dragSourceId} dropTargetId={dropTargetId}
              onDragStart={handleDragStart} onDragEnter={handleDragEnter}
              onDragEnd={handleDragEnd} onDrop={handleDrop}
              onDuplicate={handleDuplicate}
              gitStatus={gitStatusMap.get(node.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}
