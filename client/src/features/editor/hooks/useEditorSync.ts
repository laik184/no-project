import { useEffect, useRef } from 'react';
import { useRealtime } from '@/realtime/realtime-provider';
import { saveQueueService } from '../services/save-queue.ts';

interface UseEditorSyncOptions {
  filePath: string | undefined;
  hasPendingEdits: boolean;
  onExternalChange: (newContent: string, serverMtime: number) => void;
}

function pathsMatch(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '');
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.endsWith('/' + nb) || nb.endsWith('/' + na);
}

export function useEditorSync({
  filePath,
  hasPendingEdits,
  onExternalChange,
}: UseEditorSyncOptions): void {
  const { subscribe } = useRealtime();
  const filePathRef = useRef(filePath);
  const hasPendingRef = useRef(hasPendingEdits);

  useEffect(() => { filePathRef.current = filePath; }, [filePath]);
  useEffect(() => { hasPendingRef.current = hasPendingEdits; }, [hasPendingEdits]);

  useEffect(() => {
    if (!filePath) return;

    const unsub = subscribe('file', (raw) => {
      const d = raw as { type?: string; path?: string };
      if (!d.path || !filePathRef.current) return;
      if (d.type !== 'change' && d.type !== 'add') return;
      if (!pathsMatch(d.path, filePathRef.current)) return;
      if (hasPendingRef.current) return;

      const path = filePathRef.current;
      fetch(`/api/read-file?filePath=${encodeURIComponent(path)}`)
        .then((r) => r.json())
        .then((data: { ok: boolean; content?: string; modifiedAt?: string }) => {
          if (!data.ok || data.content === undefined) return;
          if (filePathRef.current !== path) return;
          const mtime = data.modifiedAt ? new Date(data.modifiedAt).getTime() : Date.now();
          saveQueueService.updateServerMtime(path, mtime);
          onExternalChange(data.content, mtime);
        })
        .catch(() => {});
    });

    return unsub;
  }, [filePath, subscribe]);
}
