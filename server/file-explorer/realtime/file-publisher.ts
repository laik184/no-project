/**
 * server/file-explorer/realtime/file-publisher.ts
 * Publishes FileExplorerEvent to TOPIC.FILE via sseManager.
 * This is the ONLY place that calls sseManager.publish for file events.
 * Critical fix: old code emitted to 'agent.event' → TOPIC.AGENT. Now we publish to TOPIC.FILE.
 */

import { sseManager } from '../../infrastructure/index.ts';
import { TOPIC }      from '../../infrastructure/index.ts';
import type { FileExplorerEvent, FileEventKind } from '../contracts/index.ts';

/** Publishes a typed file event to all SSE clients subscribed to TOPIC.FILE. */
export function publish(event: FileExplorerEvent): void {
  try {
    sseManager.publish(TOPIC.FILE, event, event.projectId || null);
  } catch (err) {
    console.error('[file-publisher] Failed to publish SSE event:', err);
  }
}

/** Convenience builders for each event kind. */
export function publishCreated(path: string, projectId = 0, size?: number): void {
  publish(buildEvent('created', path, projectId, undefined, size));
}

export function publishModified(path: string, projectId = 0, size?: number): void {
  publish(buildEvent('modified', path, projectId, undefined, size));
}

export function publishDeleted(path: string, projectId = 0): void {
  publish(buildEvent('deleted', path, projectId));
}

export function publishRenamed(path: string, newPath: string, projectId = 0): void {
  publish(buildEvent('renamed', path, projectId, newPath));
}

export function publishUploaded(path: string, projectId = 0, size?: number): void {
  publish(buildEvent('uploaded', path, projectId, undefined, size));
}

/**
 * Emitted while an AI agent is streaming content into a file.
 * The frontend uses this to show a live "writing…" spinner on the file row.
 * Call repeatedly as bytes arrive; the frontend auto-clears after 15 s of silence.
 */
export function publishWriting(path: string, projectId = 0, size?: number): void {
  publish(buildEvent('writing', path, projectId, undefined, size));
}

function buildEvent(
  type:      FileEventKind,
  path:      string,
  projectId: number,
  newPath?:  string,
  size?:     number,
): FileExplorerEvent {
  return { type, path, newPath, projectId, ts: Date.now(), size };
}
