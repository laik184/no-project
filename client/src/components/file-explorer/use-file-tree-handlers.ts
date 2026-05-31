import JSZip from "jszip";
import { FileNode } from "./types";
import { guessLang } from "./file-icon";
import {
  deleteNodeById, renameNodeById, addNodeToRoot, addNodeInsideFolder,
  uid, moveNode, getDescendantIds, duplicateName,
} from "./tree-helpers";
import { flattenVisibleIds, buildTreeFromFiles } from "./file-tree-panel-helpers";

export interface UseFileTreeHandlersOpts {
  tree: FileNode[];
  setTree: React.Dispatch<React.SetStateAction<FileNode[]>>;
  showHidden: boolean;
  onFileOpen: (name: string, content: string, lang: string) => void;
  setCreatingFile: (v: boolean) => void;
  setCreatingFolder: (v: boolean) => void;
  setShowMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setCollapseRevision: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  uploadRef: React.RefObject<HTMLInputElement>;
  expandedIdsRef: React.MutableRefObject<Set<string>>;
  lastSelectedIdRef: React.MutableRefObject<string | null>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setDragSourceId: (v: string | null) => void;
  setDropTargetId: (v: string | null) => void;
}

export function useFileTreeHandlers(o: UseFileTreeHandlersOpts) {
  const handleSelect = (node: FileNode) => {
    if (node.type === "file") o.onFileOpen(node.name, node.content ?? "", node.lang ?? guessLang(node.name));
  };

  const handleDelete = (id: string) => o.setTree(p => deleteNodeById(p, id));
  const handleRename = (id: string, name: string) => o.setTree(p => renameNodeById(p, id, name));

  const handleCreateInside = (type: "file" | "folder", name: string, parentId: string) => {
    const newNode: FileNode = type === "file"
      ? { id: uid(), name, type: "file", lang: guessLang(name), content: "" }
      : { id: uid(), name, type: "folder", children: [] };
    o.setTree(p => addNodeInsideFolder(p, parentId, newNode));
    if (type === "file") o.onFileOpen(name, "", guessLang(name));
  };

  const handleNewFile = (name: string) => {
    o.setTree(p => addNodeToRoot(p, { id: uid(), name, type: "file", lang: guessLang(name), content: "" }));
    o.setCreatingFile(false);
    o.onFileOpen(name, "", guessLang(name));
  };

  const handleNewFolder = (name: string) => {
    o.setTree(p => addNodeToRoot(p, { id: uid(), name, type: "folder", children: [] }));
    o.setCreatingFolder(false);
  };

  const handleMultiSelect = (id: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      o.setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else if (e.shiftKey && o.lastSelectedIdRef.current) {
      const visible = flattenVisibleIds(
        o.showHidden ? o.tree : o.tree.filter(n => !n.name.startsWith(".")),
        o.expandedIdsRef.current,
      );
      const a = visible.indexOf(o.lastSelectedIdRef.current);
      const b = visible.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        o.setSelectedIds(new Set(visible.slice(lo, hi + 1)));
      }
    } else {
      o.setSelectedIds(new Set());
    }
    o.lastSelectedIdRef.current = id;
  };

  const handleDragStart = (id: string, _isDir: boolean) => o.setDragSourceId(id);
  const handleDragEnter = (id: string) => o.setDropTargetId(id);
  const handleDragEnd   = () => { o.setDragSourceId(null); o.setDropTargetId(null); };

  const handleDrop = (sourceId: string, targetId: string) => {
    o.setDragSourceId(null); o.setDropTargetId(null);
    if (sourceId === targetId) return;
    const descendants = getDescendantIds(o.tree, sourceId);
    if (descendants.has(targetId)) return;
    o.setTree(prev => moveNode(prev, sourceId, targetId));
  };

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
    const src = findNode(o.tree);
    if (!src) return;
    const sibNames = findSiblingNames(o.tree) ?? [];
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
    o.setTree(prev => insertAfter(prev));
  };

  const handleUploadFolder = () => { o.uploadRef.current?.click(); o.setShowMenu(false); };

  const handleFolderSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const readText = (file: File): Promise<{ path: string; content: string }> =>
      new Promise(resolve => {
        const reader = new FileReader();
        reader.onload  = () => resolve({ path: file.webkitRelativePath || file.name, content: reader.result as string });
        reader.onerror = () => resolve({ path: file.webkitRelativePath || file.name, content: "" });
        reader.readAsText(file);
      });
    const items = await Promise.all(files.map(readText));
    o.setTree(prev => [...prev, ...buildTreeFromFiles(items)]);
    e.target.value = "";
  };

  const handleDownloadZip = async () => {
    o.setShowMenu(false);
    const zip = new JSZip();
    const addNodes = (nodes: FileNode[], prefix = "") => {
      for (const node of nodes) {
        const path = prefix ? `${prefix}/${node.name}` : node.name;
        if (node.type === "file")       zip.file(path, node.content ?? "");
        else if (node.children?.length) addNodes(node.children, path);
        else                            zip.folder(path);
      }
    };
    addNodes(o.tree);
    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "project.zip" }).click();
    URL.revokeObjectURL(url);
  };

  const handleToggleHidden = () => { o.setShowMenu(v => !v); };
  const handleCollapseAll  = () => { o.setCollapseRevision(v => v + 1); o.setShowMenu(false); };
  const handleCloseFiles   = () => { o.setShowMenu(false); o.onClose(); };

  return {
    handleSelect, handleDelete, handleRename, handleCreateInside,
    handleNewFile, handleNewFolder, handleMultiSelect,
    handleDragStart, handleDragEnter, handleDragEnd, handleDrop,
    handleDuplicate, handleUploadFolder, handleFolderSelected,
    handleDownloadZip, handleToggleHidden, handleCollapseAll, handleCloseFiles,
  };
}
