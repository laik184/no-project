import { useEffect, useRef } from 'react';
import { useRealtime } from '@/realtime/realtime-provider';
import { dirtyStateStore } from '@/features/editor-state/dirty-state.store';
import { saveQueueService } from '../services/save-queue';

interface UseEditorSyncOptions {
  tabId: number;
  filePath: string | undefined;
  onExternalChange: (newContent: string, serverMtime: number) => void;
}

function pathsMatch(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '');
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.endsWith('/' + nb) || nb.endsWith('/' + na);
}

export function useEditorSync({
  tabId,
  filePath,
  onExternalChange,
}: UseEditorSyncOptions): void {
  const { subscribe } = useRealtime();
  const tabIdRef = useRef(tabId);
  const filePathRef = useRef(filePath);

  useEffect(() => { tabIdRef.current = tabId; }, [tabId]);
  useEffect(() => { filePathRef.current = filePath; }, [filePath]);

  useEffect(() => {
    if (!filePath) return;

    const unsub = subscribe('file', (raw) => {
      const d = raw as { type?: string; path?: string };
      if (!d.path || !filePathRef.current) return;
      if (d.type !== 'change' && d.type !== 'add') return;
      if (!pathsMatch(d.path, filePathRef.current)) return;

      const tid = tabIdRef.current;
      const fp = filePathRef.current;

      if (!dirtyStateStore.canReceiveExternalChange(tid)) return;
      if (saveQueueService.isInFlight(fp)) return;

      fetch(`/api/read-file?filePath=${encodeURIComponent(fp)}`)
        .then((r) => r.json())
        .then((data: { ok: boolean; content?: string; modifiedAt?: string }) => {
          if (!data.ok || data.content === undefined) return;
          if (filePathRef.current !== fp) return;

          const mtime = data.modifiedAt ? new Date(data.modifiedAt).getTime() : Date.now();

          if (!dirtyStateStore.canReceiveExternalChange(tid)) return;

          saveQueueService.updateServerMtime(fp, mtime);
          dirtyStateStore.applyExternalContent(tid, mtime);
          onExternalChange(data.content, mtime);
        })
        .catch(() => {});
    });

    return unsub;
  }, [filePath, subscribe]);
}
