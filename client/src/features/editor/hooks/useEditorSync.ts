import { useEffect, useRef } from 'react';
import { useRealtime } from '@/realtime/realtime-provider';
import { dirtyStateStore } from '@/features/editor-state/dirty-state.store';
import { saveQueueService } from '../services/save-queue';

interface UseEditorSyncOptions {
  tabId: number;
  filePath: string | undefined;
  /**
   * Numeric project ID used to scope SSE file events. Events from a different
   * project are ignored. projectId=0 (broadcast) is always accepted because
   * user-initiated saves emit it as a wildcard when no x-project-id header is
   * present.
   */
  projectId?: number;
  onExternalChange: (newContent: string, serverMtime: number) => void;
}

/**
 * Match a SSE event path against the currently open file path.
 *
 * Rules (strict — avoids false positives):
 *  1. Exact match after normalization.
 *  2. eventPath ends with '/' + filePath — but ONLY when filePath itself
 *     contains at least one '/' (so bare filenames like "index.ts" are never
 *     matched by suffix, preventing cross-directory false positives).
 *
 * Examples:
 *   ("src/App.tsx",            "src/App.tsx")     → true   (exact)
 *   ("/sandbox/3/src/App.tsx", "src/App.tsx")     → true   (anchored suffix)
 *   ("server/api/index.ts",    "index.ts")        → false  (bare name — no suffix)
 *   ("server/api/index.ts",    "api/index.ts")    → true   (suffix with segment)
 */
function pathsMatch(eventPath: string, filePath: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '');
  const ep = norm(eventPath);
  const fp = norm(filePath);
  if (ep === fp) return true;
  return fp.includes('/') && ep.endsWith('/' + fp);
}

export function useEditorSync({
  tabId,
  filePath,
  projectId,
  onExternalChange,
}: UseEditorSyncOptions): void {
  const { subscribe } = useRealtime();

  // Always-current refs — updated synchronously when props change
  const tabIdRef      = useRef(tabId);
  const filePathRef   = useRef(filePath);
  const projectIdRef  = useRef(projectId);

  useEffect(() => { tabIdRef.current = tabId; },       [tabId]);
  useEffect(() => { filePathRef.current = filePath; }, [filePath]);
  useEffect(() => { projectIdRef.current = projectId; }, [projectId]);

  // Generation counter: monotonically incremented every time a new fetch is
  // launched for this tab. When the async response arrives we compare the
  // generation; if it doesn't match, a newer fetch has superseded this one
  // and the result is discarded — preventing stale-write race conditions.
  const fetchGenRef = useRef(0);

  useEffect(() => {
    if (!filePath) return;

    const unsub = subscribe('file', (raw) => {
      const d = raw as { type?: string; path?: string; projectId?: number };
      if (!d.path || !filePathRef.current) return;
      if (d.type !== 'change' && d.type !== 'add') return;

      // Project scope: accept events from our project OR broadcast (projectId=0).
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

      // First dirty/saving check — avoids launching a fetch we'll discard anyway.
      if (!dirtyStateStore.canReceiveExternalChange(tid)) return;
      if (saveQueueService.isInFlight(fp)) return;

      // Claim the current generation. If a newer event fires before this fetch
      // resolves, fetchGenRef.current will be incremented past `gen` and we'll
      // discard the stale result below.
      const gen = ++fetchGenRef.current;

      fetch(`/api/read-file?filePath=${encodeURIComponent(fp)}`)
        .then((r) => r.json())
        .then((data: { ok: boolean; content?: string; modifiedAt?: string }) => {
          if (!data.ok || data.content === undefined) return;

          // Stale-path guard: tab switched while fetch was in flight.
          if (filePathRef.current !== fp) return;

          // Race condition guard: a newer fetch for this file is in flight.
          if (fetchGenRef.current !== gen) return;

          // Normalise to integer milliseconds for reliable equality checks.
          const mtime = data.modifiedAt
            ? Math.round(new Date(data.modifiedAt).getTime())
            : Date.now();

          // Echo-suppression: if the mtime matches what we stored from our
          // last successful save, the SSE event is just the echo of our own
          // write — no need to push the same content back into Monaco.
          const knownMtime = dirtyStateStore.getTab(tid)?.serverMtime;
          if (
            knownMtime !== null &&
            knownMtime !== undefined &&
            Math.round(knownMtime) === mtime
          ) return;

          // Second dirty/saving check — the user may have started typing while
          // the fetch was in flight.
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
