/**
 * server/file-explorer/types/history.types.ts
 * File version history types.
 */

/** A single historical snapshot of a file. */
export interface HistoryEntry {
  readonly id:        string;
  readonly path:      string;
  readonly content:   string;
  readonly mtime:     number;
  readonly createdAt: number;
  readonly author:    string;
  readonly sizeBytes: number;
}

/** The full history list for one file. */
export interface HistoryList {
  readonly path:    string;
  readonly entries: HistoryEntry[];
  readonly total:   number;
}

/** Request to restore a specific history entry. */
export interface RestoreRequest {
  readonly path:      string;
  readonly historyId: string;
}
