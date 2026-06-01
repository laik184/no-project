/**
 * server/file-explorer/watchers/file-watcher.service.ts
 * Chokidar-based watcher for file-level changes in the sandbox.
 * Debounces events and publishes them to TOPIC.FILE via the realtime layer.
 */

import path from 'path';
import { FE_CONFIG }       from '../config/index.ts';
import { publishCreated, publishModified, publishDeleted } from '../realtime/index.ts';
import { toRelative }      from '../utils/index.ts';

type Watcher = { close(): Promise<void> };

let watcher: Watcher | null = null;
const debounceMap = new Map<string, ReturnType<typeof setTimeout>>();

function debounce(key: string, fn: () => void, ms: number): void {
  const existing = debounceMap.get(key);
  if (existing) clearTimeout(existing);
  debounceMap.set(key, setTimeout(() => { debounceMap.delete(key); fn(); }, ms));
}

/** Starts the chokidar file watcher on the sandbox root. Idempotent. */
export async function startFileWatcher(sandboxRoot = FE_CONFIG.sandboxRoot): Promise<void> {
  if (watcher) return;

  const { default: chokidar } = await import('chokidar');
  const DEBOUNCE_MS = FE_CONFIG.watcherDebounceMs;

  watcher = chokidar.watch(sandboxRoot, {
    ignored:        /node_modules|\.git|\.cache/,
    persistent:     true,
    ignoreInitial:  true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  (watcher as unknown as ReturnType<typeof chokidar.watch>)
    .on('add',    (abs: string) => { const rel = toRelative(abs, sandboxRoot); debounce(rel, () => publishCreated(rel, 0), DEBOUNCE_MS); })
    .on('change', (abs: string) => { const rel = toRelative(abs, sandboxRoot); debounce(rel, () => publishModified(rel, 0), DEBOUNCE_MS); })
    .on('unlink', (abs: string) => { const rel = toRelative(abs, sandboxRoot); debounce(rel, () => publishDeleted(rel, 0), DEBOUNCE_MS); })
    .on('error',  (err: unknown) => console.error('[file-watcher] Error:', err));
}

/** Stops the watcher and releases resources. */
export async function stopFileWatcher(): Promise<void> {
  if (!watcher) return;
  await watcher.close();
  watcher = null;
  debounceMap.clear();
}
