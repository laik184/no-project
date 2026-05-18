import { useState, useEffect } from "react";
import { RawTreeNode } from "./types";
import { optimisticInsertFile, removeOptimisticFile } from "./tree-helpers";
import { useRealtimeEvent } from "@/realtime/useRealtimeStream";

interface UseFileExplorerOptions {
  projectPath: string;
  activeFile?: string;
}

export function useFileExplorer({ projectPath, activeFile }: UseFileExplorerOptions) {
  const [tree, setTree]               = useState<RawTreeNode[]>([]);
  const [dirtyFiles, setDirtyFiles]   = useState<Set<string>>(new Set());
  const [aiFiles, setAiFiles]         = useState<Set<string>>(new Set());
  const [writingFiles, setWritingFiles] = useState<Set<string>>(new Set());
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

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

  // Extract the numeric project ID from the sandbox path (e.g. ".data/sandboxes/7" → "7").
  // This is used to match against FileChangeEvent.projectId which is a number.
  const sandboxId = projectPath
    ? projectPath.split("/").filter(Boolean).pop() ?? projectPath
    : "";

  // Agent events — highlight AI-written files and refresh tree on diffs
  useRealtimeEvent("agent", (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.type === "diff" && (d.diff as any)?.path) {
        setAiFiles((prev) => new Set(prev).add((d.diff as any).path));
        if (!d.projectId || String(d.projectId) === sandboxId) refreshFiles();
      }
    } catch {}
  });

  // Console events — refresh tree when file-related messages arrive
  useRealtimeEvent("console", (data) => {
    try {
      const d = data as Record<string, unknown>;
      if (d.file || (d.msg && String(d.msg).includes("file"))) {
        if (!d.projectId || String(d.projectId) === sandboxId) refreshFiles();
      }
    } catch {}
  });

  // File-change events — refresh tree and track AI in-flight writes.
  // d.projectId is a number; sandboxId is the trailing segment of the sandbox path.
  useRealtimeEvent("file", (data) => {
    try {
      const d = data as { projectId?: number; type?: string; path?: string };
      const mine = !d.projectId || String(d.projectId) === sandboxId;
      if (!mine) return;

      if (d.type === "writing" && d.path) {
        // AI has started writing — mark file as in-flight
        setWritingFiles((prev) => new Set(prev).add(d.path!));
        // Safety fallback: auto-clear after 15 seconds in case completion event is missed
        setTimeout(() => {
          setWritingFiles((prev) => { const n = new Set(prev); n.delete(d.path!); return n; });
        }, 15_000);
      } else {
        // Write completed (add / change / unlink) — clear in-flight state and refresh tree
        if (d.path) {
          setWritingFiles((prev) => { const n = new Set(prev); n.delete(d.path!); return n; });
        }
        refreshFiles();
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
    tree, dirtyFiles, aiFiles, writingFiles, focusedPath, hoveredPath,
    setFocusedPath, setHoveredPath,
    refreshFiles, apiSaveFile,
    handleRenamePath, handleDeletePath,
  };
}
