/**
 * server/file-explorer/contracts/events.ts
 * SSE event shapes published on TOPIC.FILE.
 * Must stay in sync with the frontend realtime event consumers.
 */

export type FileEventKind =
  | 'created'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'uploaded'
  | 'writing';   // agent is actively streaming content into the file

/** Payload published to TOPIC.FILE on every file mutation. */
export interface FileExplorerEvent {
  readonly type:      FileEventKind;
  readonly path:      string;
  readonly newPath?:  string;      // rename only
  readonly projectId: number;
  readonly ts:        number;      // ms since epoch
  readonly size?:     number;      // bytes; created/modified only
}
