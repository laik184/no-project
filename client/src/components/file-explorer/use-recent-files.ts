import { useState, useCallback } from "react";

const STORAGE_KEY = "nura-x:recent-files";
const MAX_RECENT  = 8;

const isFile = (path: string) => /\.[^/]+$/.test(path);

function load(): string[] {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(s) ? s.slice(0, MAX_RECENT) : [];
  } catch { return []; }
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<string[]>(load);

  const recordOpen = useCallback((path: string) => {
    if (!isFile(path)) return;
    setRecentFiles(prev => {
      const next = [path, ...prev.filter(p => p !== path)].slice(0, MAX_RECENT);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentFiles([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { recentFiles, recordOpen, clearRecent };
}
