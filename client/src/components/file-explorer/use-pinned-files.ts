import { useState, useCallback } from "react";

const STORAGE_KEY = "nura-x:pinned-files";
const MAX_PINNED  = 10;

const isFile = (path: string) => /\.[^/]+$/.test(path);

function load(): string[] {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(s) ? s.slice(0, MAX_PINNED) : [];
  } catch { return []; }
}

function persist(list: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

export function usePinnedFiles() {
  const [pinnedFiles, setPinnedFiles] = useState<string[]>(load);

  const pinFile = useCallback((path: string) => {
    if (!isFile(path)) return;
    setPinnedFiles(prev => {
      if (prev.includes(path)) return prev;
      const next = [path, ...prev].slice(0, MAX_PINNED);
      persist(next);
      return next;
    });
  }, []);

  const unpinFile = useCallback((path: string) => {
    setPinnedFiles(prev => {
      const next = prev.filter(p => p !== path);
      persist(next);
      return next;
    });
  }, []);

  const isPinned = useCallback((path: string) => pinnedFiles.includes(path), [pinnedFiles]);

  const clearPinned = useCallback(() => {
    setPinnedFiles([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { pinnedFiles, pinFile, unpinFile, isPinned, clearPinned };
}
