/**
 * server/file-explorer/contracts/responses.ts
 * Typed response envelopes for every HTTP endpoint.
 * All responses use { ok: boolean, error?: string } as the base.
 */

import type { RawTreeNode } from '../types/index.ts';
import type { FileMeta, ProjectInsights } from '../types/index.ts';
import type { HistoryEntry } from '../types/index.ts';
import type { ClipboardEntry } from '../types/index.ts';

interface BaseResponse {
  readonly ok:    boolean;
  readonly error?: string;
}

export interface TreeResponse extends BaseResponse {
  readonly tree: RawTreeNode[];
}

export interface ReadResponse extends BaseResponse {
  readonly content?:     string;
  readonly serverMtime?: number;
  readonly modifiedAt?:  string;
  readonly encoding?:    string;
}

export interface WriteResponse extends BaseResponse {
  readonly serverMtime?: number;
  readonly conflict?:    boolean;
}

export interface CreateResponse extends BaseResponse {
  readonly path?: string;
}

export interface RenameResponse extends BaseResponse {}

export interface DeleteResponse extends BaseResponse {}

export interface DuplicateResponse extends BaseResponse {
  readonly destPath?: string;
}

export interface UploadedFile {
  readonly originalName: string;
  readonly savedPath:    string;
  readonly size:         number;
}

export interface UploadResponse extends BaseResponse {
  readonly uploaded: UploadedFile[];
  readonly failed:   string[];
}

export interface SearchMatch {
  readonly path:    string;
  readonly line:    number;
  readonly column:  number;
  readonly text:    string;
  readonly preview: string;
}

export interface SearchResponse extends BaseResponse {
  readonly matches: SearchMatch[];
  readonly total:   number;
}

export interface MetadataResponse extends BaseResponse {
  readonly meta?: FileMeta;
}

export interface InsightsResponse extends BaseResponse {
  readonly insights?: ProjectInsights;
}

export interface HistoryResponse extends BaseResponse {
  readonly history: HistoryEntry[];
  readonly total:   number;
}

export interface ClipboardResponse extends BaseResponse {
  readonly clipboard?: ClipboardEntry | null;
}

/** Response from POST /file/undo — restores the previous file version. */
export interface UndoResponse extends BaseResponse {
  readonly restored?: boolean;
}

/**
 * Response from POST /file/conflict-check.
 * conflict:true means the server has a newer version than baseVersionId.
 */
export interface ConflictCheckResponse extends BaseResponse {
  readonly conflict:         boolean;
  readonly currentVersionId?: string;
}

/**
 * Flat metadata response for the legacy /files/stat endpoint.
 * Frontend expects { ok, size, mtime } at the top level (not nested under meta).
 */
export interface MetadataFlatResponse extends BaseResponse {
  readonly size?:  number;
  readonly mtime?: number;
}

export interface HealthResponse extends BaseResponse {
  readonly module:      string;
  readonly sandboxRoot: string;
  readonly uptime:      number;
}
