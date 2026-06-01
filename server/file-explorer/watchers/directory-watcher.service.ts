/**
 * server/file-explorer/watchers/directory-watcher.service.ts
 * Chokidar-based watcher for directory-level changes in the sandbox.
 * Publishes create/delete events when directories are added or removed.
 */

import { FE_CONFIG }       from '../config/index.ts';
import { publishCreated, publishDeleted } from '../realtime/index.ts';
import { toRelative }      from '../utils/index.ts';

type Watcher = { close(): Promise<void> };
let dirWatcher: Watcher | null = null;

/** Starts the directory watcher. Idempotent — safe to call multiple times. */
export async function startDirectoryWatcher(sandboxRoot = FE_CONFIG.sandboxRoot): Promise<void> {
  if (dirWatcher) return;

  const { default: chokidar } = await import('chokidar');

  dirWatcher = chokidar.watch(sandboxRoot, {
    ignored:       /node_modules|\.git|\.cache/,
    persistent:    true,
    ignoreInitial: true,
    depth:         10,
  });

  (dirWatcher as unknown as ReturnType<typeof chokidar.watch>)
    .on('addDir',    (abs: string) => { const rel = toRelative(abs, sandboxRoot); publishCreated(rel, 0); })
    .on('unlinkDir', (abs: string) => { const rel = toRelative(abs, sandboxRoot); publishDeleted(rel, 0); })
    .on('error',     (err: unknown) => console.error('[dir-watcher] Error:', err));
}

/** Stops the directory watcher. */
export async function stopDirectoryWatcher(): Promise<void> {
  if (!dirWatcher) return;
  await dirWatcher.close();
  dirWatcher = null;
}
