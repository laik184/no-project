import { useState, useCallback } from "react";

const STORAGE_KEY = "nura-x:open-editors";
const MAX_OPEN    = 12;

const isFile = (path: string) => /\.[^/]+$/.test(path);

function load(): string[] {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(s) ? s.slice(0, MAX_OPEN) : [];
  } catch { return []; }
}

function persist(list: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

export function useOpenEditors() {
  const [openFiles, setOpenFiles] = useState<string[]>(load);

  const openFile = useCallback((path: string) => {
    if (!isFile(path)) return;
    setOpenFiles(prev => {
      const next = [path, ...prev.filter(p => p !== path)].slice(0, MAX_OPEN);
      persist(next);
      return next;
    });
  }, []);

  const closeFile = useCallback((path: string) => {
    setOpenFiles(prev => {
      const next = prev.filter(p => p !== path);
      persist(next);
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    setOpenFiles([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return { openFiles, openFile, closeFile, closeAll };
}
