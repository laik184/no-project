/**
 * file-change-emitter.ts
 *
 * Thin, deduplicated wrapper around bus.emit("file.change").
 *
 * Single responsibility:
 *   Accept a file mutation event from any agent tool and emit it onto
 *   the global EventBus with deduplication so rapid successive writes
 *   to the same file do not spam SSE clients.
 *
 * Callers: file-tools.ts, file-search-tools.ts, env-tools.ts
 */

import { bus } from './bus.ts';
import type { FileChangeEvent } from './bus.ts';

// ─── Deduplication ────────────────────────────────────────────────────────────
// Tracks the last emission key+timestamp to collapse duplicate events
// that arrive within the debounce window (e.g. write + chmod by same tool).

const DEBOUNCE_MS = 80;
const _pending = new Map<string, ReturnType<typeof setTimeout>>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Emit a file.change event onto the EventBus, debounced per (projectId, path, type).
 *
 * @param projectId  Numeric project ID from ToolContext
 * @param type       "add" for new files, "change" for writes, "unlink" for deletes
 * @param filePath   Path relative to the project sandbox root
 */
export function emitFileChange(
  projectId: number,
  type: FileChangeEvent['type'],
  filePath: string,
): void {
  const key = `${projectId}::${type}::${filePath}`;

  const existing = _pending.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    _pending.delete(key);
    bus.emit('file.change', {
      projectId,
      type,
      path: filePath,
      ts: Date.now(),
    });
  }, DEBOUNCE_MS);

  _pending.set(key, timer);
}

/**
 * Immediately signal that the AI agent has started writing a file (no debounce).
 * The SSE "file" topic carries this as type="writing".
 * The natural completion event (type="add"|"change") clears the in-flight state.
 *
 * @param projectId  Numeric project ID from ToolContext
 * @param filePath   Path relative to the project sandbox root
 */
export function emitFileWriting(projectId: number, filePath: string): void {
  bus.emit('file.change', {
    projectId,
    type: 'writing',
    path: filePath,
    ts: Date.now(),
  });
}
