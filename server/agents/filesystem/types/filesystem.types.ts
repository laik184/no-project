/**
 * server/agents/filesystem/types/filesystem.types.ts
 *
 * All shared type contracts for the filesystem agent layer.
 * No runtime logic — types and interfaces only.
 */

// ── Operation kinds ───────────────────────────────────────────────────────────

export type FilesystemOperationKind =
  | 'read'
  | 'write'
  | 'patch'
  | 'delete'
  | 'search';

// ── Operation status ──────────────────────────────────────────────────────────

export type FilesystemOperationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled';

// ── Session status ────────────────────────────────────────────────────────────

export type FilesystemSessionStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed';

// ── Read operation ────────────────────────────────────────────────────────────

export interface ReadOperationRequest {
  kind:       'read';
  path:       string;
  startLine?: number;
  endLine?:   number;
  encoding?:  string;
}

export interface ReadOperationResult {
  kind:       'read';
  path:       string;
  content:    string;
  lineCount?: number;
  sizeBytes?: number;
}

// ── Write operation ───────────────────────────────────────────────────────────

export interface WriteOperationRequest {
  kind:      'write';
  path:      string;
  content:   string;
  append?:   boolean;
  onlyIfAbsent?: boolean;
}

export interface WriteOperationResult {
  kind:    'write';
  path:    string;
  written: boolean;
}

// ── Patch operation ───────────────────────────────────────────────────────────

export interface PatchHunk {
  oldText: string;
  newText: string;
}

export interface PatchOperationRequest {
  kind:   'patch';
  path:   string;
  hunks:  PatchHunk[];
  patchAll?: boolean;
}

export interface PatchOperationResult {
  kind:         'patch';
  path:         string;
  hunksApplied: number;
}

// ── Delete operation ──────────────────────────────────────────────────────────

export interface DeleteOperationRequest {
  kind:      'delete';
  path:      string;
  recursive?: boolean;
  multiple?:  string[];
}

export interface DeleteOperationResult {
  kind:    'delete';
  path:    string;
  deleted: boolean;
}

// ── Search operation ──────────────────────────────────────────────────────────

export type SearchKind =
  | 'by_name'
  | 'by_extension'
  | 'by_pattern'
  | 'text'
  | 'regex'
  | 'imports'
  | 'exports'
  | 'symbol';

export interface SearchOperationRequest {
  kind:        'search';
  searchKind:  SearchKind;
  query:       string;
  rootPath?:   string;
  caseSensitive?: boolean;
  maxResults?: number;
}

export interface SearchMatch {
  path:    string;
  line?:   number;
  snippet?: string;
}

export interface SearchOperationResult {
  kind:    'search';
  query:   string;
  matches: SearchMatch[];
  total:   number;
}

// ── Union types ───────────────────────────────────────────────────────────────

export type FilesystemOperationRequest =
  | ReadOperationRequest
  | WriteOperationRequest
  | PatchOperationRequest
  | DeleteOperationRequest
  | SearchOperationRequest;

export type FilesystemOperationResult =
  | ReadOperationResult
  | WriteOperationResult
  | PatchOperationResult
  | DeleteOperationResult
  | SearchOperationResult;

// ── Execution context ─────────────────────────────────────────────────────────

export interface FilesystemExecutionContext {
  readonly runId:       string;
  readonly projectId:   string;
  readonly sandboxRoot: string;
  readonly sessionId:   string;
  readonly signal?:     AbortSignal;
}

// ── Operation wrapper (runtime) ───────────────────────────────────────────────

export interface FilesystemOperation {
  readonly operationId: string;
  readonly request:     FilesystemOperationRequest;
  status:               FilesystemOperationStatus;
  retryCount:           number;
  startedAt?:           Date;
  completedAt?:         Date;
  result?:              FilesystemOperationResult;
  error?:               string;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface FilesystemSession {
  readonly sessionId:   string;
  readonly runId:       string;
  readonly projectId:   string;
  status:               FilesystemSessionStatus;
  readonly startedAt:   Date;
  endedAt?:             Date;
  operationsTotal:      number;
  operationsDone:       number;
}

// ── Agent result ──────────────────────────────────────────────────────────────

export interface FilesystemAgentResult {
  ok:                  boolean;
  sessionId:           string;
  runId:               string;
  operationsTotal:     number;
  operationsCompleted: number;
  operationsFailed:    number;
  durationMs:          number;
  results:             FilesystemOperationResult[];
  error?:              string;
}

// ── Routing ───────────────────────────────────────────────────────────────────

export interface RoutedOperation {
  toolName:  string;
  toolInput: Record<string, unknown>;
}

// ── Retry config ──────────────────────────────────────────────────────────────

export interface FilesystemRetryConfig {
  maxAttempts: number;
  delayMs:     number;
  backoff:     'none' | 'linear' | 'exponential';
}

// ── Failure record ────────────────────────────────────────────────────────────

export interface FilesystemFailureRecord {
  operationId: string;
  runId:       string;
  kind:        FilesystemOperationKind;
  error:       string;
  retryCount:  number;
  timestamp:   Date;
}
