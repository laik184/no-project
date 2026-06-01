/**
 * server/file-explorer/index.ts
 * PUBLIC entry point for the file-explorer module.
 * External consumers MUST import only from this file — never from sub-paths.
 *
 * Usage in server/preview/index.ts:
 *   import { fileExplorerRouter, startFileWatcher, subscribeToAgentFileEvents }
 *     from '../file-explorer/index.ts';
 */

// ── Router ────────────────────────────────────────────────────────────────────
export { fileExplorerRouter }          from './routes/index.ts';

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export { startFileWatcher, stopFileWatcher }           from './watchers/index.ts';
export { startDirectoryWatcher, stopDirectoryWatcher } from './watchers/index.ts';
export { subscribeToAgentFileEvents }                  from './realtime/index.ts';

// ── Types (consumers may import for typing purposes) ──────────────────────────
export type {
  RawTreeNode, FileKind, FileEncoding, FileStat,
  FileEntry, FileContent, WriteResult, ClipboardEntry, ClipboardOp,
  TreeBuildOptions, TreeStats,
  HistoryEntry, HistoryList, RestoreRequest,
  FileMeta, ProjectInsights,
} from './types/index.ts';

export type {
  TreeRequest, ReadRequest, WriteRequest, CreateRequest, RenameRequest,
  DeleteRequest, DuplicateRequest, UploadRequest, DownloadRequest, SearchRequest,
  MetadataRequest, HistoryRequest,
  TreeResponse, ReadResponse, WriteResponse, CreateResponse, RenameResponse,
  DeleteResponse, DuplicateResponse, UploadResponse, UploadedFile, SearchResponse,
  SearchMatch, MetadataResponse, InsightsResponse, HistoryResponse, ClipboardResponse,
  HealthResponse,
  FileExplorerEvent, FileEventKind,
} from './contracts/index.ts';

export type { ExplorerConfig } from './config/index.ts';
export { FE_CONFIG }           from './config/index.ts';
