import { useEffect, useRef } from 'react';
import { useRealtime } from '@/realtime/realtime-provider';
import { dirtyStateStore } from '@/features/editor-state/dirty-state.store';
import { saveQueueService } from '../services/save-queue';

interface UseEditorSyncOptions {
  tabId: number;
  filePath: string | undefined;
  /** Numeric project ID used to scope SSE file events. When provided, events
   *  from a different project are ignored. projectId=0 (broadcast) is always
   *  accepted because user-initiated saves use it as a wildcard. */
  projectId?: number;
  onExternalChange: (newContent: string, serverMtime: number) => void;
}

/**
 * Match a SSE event path against the currently open file path.
 *
 * Rules (strict, avoids false positives):
 *  1. Exact match after normalization.
 *  2. eventPath ends with '/' + filePath — but ONLY when filePath itself
 *     contains at least one '/' (so bare filenames like "index.ts" are
 *     never matched by suffix, preventing cross-directory false positives).
 *
 * Examples:
 *   ("src/App.tsx",        "src/App.tsx")         → true   (exact)
 *   ("/sandbox/3/src/App.tsx", "src/App.tsx")     → true   (anchored suffix)
 *   ("server/api/index.ts", "index.ts")           → false  (bare name, no suffix)
 *   ("server/api/index.ts", "api/index.ts")       → true   (suffix with segment)
 */
function pathsMatch(eventPath: string, filePath: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '');
  const ep = norm(eventPath);
  const fp = norm(filePath);
  if (ep === fp) return true;
  // Tail-anchor suffix match — only when filePath has a directory component
  return fp.includes('/') && ep.endsWith('/' + fp);
}

export function useEditorSync({
  tabId,
  filePath,
  projectId,
  onExternalChange,
}: UseEditorSyncOptions): void {
  const { subscribe } = useRealtime();
  const tabIdRef      = useRef(tabId);
  const filePathRef   = useRef(filePath);
  const projectIdRef  = useRef(projectId);

  useEffect(() => { tabIdRef.current = tabId; },      [tabId]);
  useEffect(() => { filePathRef.current = filePath; }, [filePath]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);

  useEffect(() => {
    if (!filePath) return;

    const unsub = subscribe('file', (raw) => {
      const d = raw as { type?: string; path?: string; projectId?: number };
      if (!d.path || !filePathRef.current) return;
      if (d.type !== 'change' && d.type !== 'add') return;

      // Project scope: accept events from our project OR broadcast (projectId=0)
      const pid = projectIdRef.current;
      if (
        pid !== undefined &&
        d.projectId !== undefined &&
        d.projectId !== 0 &&
        d.projectId !== pid
      ) return;

      if (!pathsMatch(d.path, filePathRef.current)) return;

      const tid = tabIdRef.current;
      const fp  = filePathRef.current;

      // Do not overwrite user edits or a save in progress
      if (!dirtyStateStore.canReceiveExternalChange(tid)) return;
      if (saveQueueService.isInFlight(fp)) return;

      fetch(`/api/read-file?filePath=${encodeURIComponent(fp)}`)
        .then((r) => r.json())
        .then((data: { ok: boolean; content?: string; modifiedAt?: string }) => {
          if (!data.ok || data.content === undefined) return;
          if (filePathRef.current !== fp) return;

          const mtime = data.modifiedAt
            ? new Date(data.modifiedAt).getTime()
            : Date.now();

          // Suppress echo: if the mtime matches what we already stored from
          // our last save, the file hasn't changed externally — skip the push.
          const knownMtime = dirtyStateStore.getTab(tid)?.serverMtime;
          if (knownMtime !== null && knownMtime !== undefined && mtime === knownMtime) return;

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
