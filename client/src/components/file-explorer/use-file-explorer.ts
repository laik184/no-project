import { useState, useEffect, useRef } from "react";
import type { ActivityKind } from "./AIActivityBadge";
import { RawTreeNode } from "./types";
import { optimisticInsertFile, removeOptimisticFile, duplicateName } from "./tree-helpers";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

interface UseFileExplorerOptions {
  projectPath: string;
  activeFile?: string;
}

export function useFileExplorer({ projectPath, activeFile }: UseFileExplorerOptions) {
  const [tree, setTree]                   = useState<RawTreeNode[]>([]);
  const [dirtyFiles, setDirtyFiles]       = useState<Set<string>>(new Set());
  const [aiFiles, setAiFiles]             = useState<Set<string>>(new Set());
  const [aiActivity, setAiActivity]       = useState<Map<string, ActivityKind>>(new Map());
  const [writingFiles, setWritingFiles]   = useState<Set<string>>(new Set());
  const [writingSizes, setWritingSizes]   = useState<Map<string, number>>(new Map());
  const [focusedPath, setFocusedPath]     = useState<string | null>(null);
  const [hoveredPath, setHoveredPath]     = useState<string | null>(null);
  const writingTimers       = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const treeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTree = () => {
    if (!projectPath) return;
    const current = projectPath;
    fetch(`/api/list-files?projectPath=${encodeURIComponent(current)}`)
      .then((r) => r.json())
      .then((j) => {
        if (current !== projectPath) return;
        if (j.ok && Array.isArray(j.tree)) setTree(j.tree);
      })
      .catch((err) => console.error("[Explorer] Failed to load tree:", err));
  };

  const refreshFiles = (optimisticPath?: string) => {
    if (optimisticPath) setTree((prev) => optimisticInsertFile(prev, optimisticPath));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("file-refresh"));
  };

  useEffect(() => { loadTree(); }, [projectPath]);

  useEffect(() => {
    const onRefresh = () => loadTree();
    const onCreateFailed = (e: Event) => {
      try {
        const path = (e as CustomEvent)?.detail?.path;
        if (path) setTree((prev) => removeOptimisticFile(prev, path));
      } catch {}
    };
    window.addEventListener("file-refresh", onRefresh);
    window.addEventListener("file-create-failed", onCreateFailed);
    window.addEventListener("explorer:refresh", onRefresh);
    return () => {
      window.removeEventListener("file-refresh", onRefresh);
      window.removeEventListener("file-create-failed", onCreateFailed);
      window.removeEventListener("explorer:refresh", onRefresh);
    };
  }, [projectPath]);

  useEffect(() => {
    const onDirty = (e: Event) => {
      const path = (e as CustomEvent).detail?.path;
      if (!path) return;
      setDirtyFiles((prev) => new Set(prev).add(path));
    };
    const onSaved = (e: Event) => {
      const path = (e as CustomEvent).detail?.path;
      if (!path) return;
      setDirtyFiles((prev) => { const n = new Set(prev); n.delete(path); return n; });
    };
    window.addEventListener("file-dirty", onDirty);
    window.addEventListener("file-saved", onSaved);
    return () => {
      window.removeEventListener("file-dirty", onDirty);
      window.removeEventListener("file-saved", onSaved);
    };
  }, []);

  const sandboxId = projectPath
    ? projectPath.split("/").filter(Boolean).pop() ?? projectPath
    : "";

  // Agent events — highlight AI-written files and refresh tree on diffs
  useRealtimeEvent("agent", (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.type === "diff" && (d.diff as any)?.path) {
        const p = (d.diff as any).path as string;
        setAiFiles((prev) => new Set(prev).add(p));
        setAiActivity((prev) => { const m = new Map(prev); m.set(p, "editing"); return m; });
        if (!d.projectId || String(d.projectId) === sandboxId) refreshFiles();
      }
    } catch {}
  });

  // File-change events — refresh tree and track AI in-flight writes.
  useRealtimeEvent("file", (data) => {
    try {
      const d = data as { projectId?: number; type?: string; path?: string; size?: number };
      const mine = !d.projectId || String(d.projectId) === sandboxId;
      if (!mine) return;

      if (d.type === "writing" && d.path) {
        setWritingFiles((prev) => new Set(prev).add(d.path!));
        setAiActivity((prev) => { const m = new Map(prev); m.set(d.path!, "editing"); return m; });
        if (d.size !== undefined) {
          setWritingSizes((prev) => { const n = new Map(prev); n.set(d.path!, d.size!); return n; });
        }
        const existingTimer = writingTimers.current.get(d.path!);
        if (existingTimer !== undefined) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          writingTimers.current.delete(d.path!);
          setWritingFiles((prev) => { const n = new Set(prev); n.delete(d.path!); return n; });
          setWritingSizes((prev) => { const n = new Map(prev); n.delete(d.path!); return n; });
        }, 15_000);
        writingTimers.current.set(d.path!, timer);
      } else {
        if (d.path) {
          const t = writingTimers.current.get(d.path!);
          if (t !== undefined) { clearTimeout(t); writingTimers.current.delete(d.path!); }
          setWritingFiles((prev) => { const n = new Set(prev); n.delete(d.path!); return n; });
          setWritingSizes((prev) => { const n = new Map(prev); n.delete(d.path!); return n; });
        }
        if (treeRefreshTimerRef.current) clearTimeout(treeRefreshTimerRef.current);
        treeRefreshTimerRef.current = setTimeout(() => {
          treeRefreshTimerRef.current = null;
          refreshFiles();
        }, 200);
      }
    } catch {}
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = focusedPath || activeFile;
      if (!target) return;
      if (e.key === "Delete") { e.preventDefault(); handleDeletePath(target); }
      if (e.key === "F2")     { e.preventDefault(); handleRenamePath(target); }
      if ((e.key === "s" || e.key === "S") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        try { window.dispatchEvent(new CustomEvent("global-save", { detail: { from: "file-explorer" } })); }
        catch { window.dispatchEvent(new Event("global-save")); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [focusedPath, activeFile]);

  useEffect(() => {
    return () => {
      for (const timer of writingTimers.current.values()) clearTimeout(timer);
      writingTimers.current.clear();
      if (treeRefreshTimerRef.current) clearTimeout(treeRefreshTimerRef.current);
    };
  }, []);

  const apiRenameFile = async (oldPath: string, newPath: string) => {
    const res = await fetch("/api/rename-file", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (!res.ok) alert("Rename failed: " + await res.text());
  };

  const apiDeleteFile = async (targetPath: string) => {
    const res = await fetch("/api/delete-file", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetPath }),
    });
    if (!res.ok) alert("Delete failed: " + await res.text());
  };

  const apiSaveFile = async (filePath: string, content: string) => {
    await fetch("/api/save-file", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath, content }),
    });
  };

  /** Move sourcePath into targetFolderPath (rename = move on the filesystem). */
  const apiMovePath = async (sourcePath: string, targetFolderPath: string) => {
    const fileName = sourcePath.split("/").pop()!;
    const newPath  = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
    if (newPath === sourcePath) return;
    await apiRenameFile(sourcePath, newPath);
    refreshFiles(newPath);
  };

  /** Duplicate a file or folder. Creates a copy with a -copy suffix alongside the original. */
  const apiDuplicatePath = async (sourcePath: string) => {
    const segments   = sourcePath.split("/");
    const fileName   = segments.pop()!;
    const parentPath = segments.join("/");

    function findSiblingNames(nodes: RawTreeNode[], parts: string[]): string[] {
      if (!parts.length) return nodes.map(n => n.name);
      const dir = nodes.find(n => n.name === parts[0] && (n.type === "folder" || n.type === "directory"));
      return dir?.children ? findSiblingNames(dir.children, parts.slice(1)) : [];
    }

    const relParts = parentPath ? parentPath.split("/").filter(Boolean) : [];
    const siblings = findSiblingNames(tree, relParts);
    const newName  = duplicateName(fileName, siblings);
    const newPath  = parentPath ? `${parentPath}/${newName}` : newName;

    try {
      const res = await fetch("/api/duplicate-file", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourcePath, destPath: newPath }),
      });
      if (!res.ok) await apiSaveFile(newPath, "");
    } catch {
      await apiSaveFile(newPath, "").catch(console.error);
    }
    refreshFiles(newPath);
  };

  const handleRenamePath = async (path: string) => {
    const segments = path.split("/");
    const oldName = segments.pop()!;
    const baseDir = segments.join("/");
    const newName = window.prompt("Rename to:", oldName);
    if (!newName || newName === oldName) return;
    const newPath = (baseDir ? baseDir + "/" : "") + newName;
    try { await apiRenameFile(path, newPath); refreshFiles(newPath); }
    catch (e) { console.error(e); }
  };

  const handleDeletePath = async (path: string) => {
    if (!window.confirm("Delete this file/folder?")) return;
    try { await apiDeleteFile(path); refreshFiles(); }
    catch (e) { console.error(e); }
  };

  return {
    tree, dirtyFiles, aiFiles, aiActivity, writingFiles, writingSizes,
    focusedPath, hoveredPath,
    setFocusedPath, setHoveredPath,
    refreshFiles, apiSaveFile, apiMovePath, apiDuplicatePath,
    handleRenamePath, handleDeletePath,
  };
}
