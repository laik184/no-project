/**
 * memory-types.ts
 *
 * All type contracts for the Memory Write Safety System.
 * No external imports — pure TypeScript interfaces and types.
 * Single source of truth for all memory-queue, transaction, and
 * validation payload shapes.
 */

// ── Queue key ─────────────────────────────────────────────────────────────────

/** Identifies an isolated write lane. Use String(projectId) or sandboxPath. */
export type QueueKey = string;

// ── File classification ────────────────────────────────────────────────────────

export type MemoryFileType = "json" | "jsonl" | "markdown" | "text";

// ── Write request ─────────────────────────────────────────────────────────────

/**
 * A single write request enqueued for safe execution.
 *
 * Either `content` (static string) or `mutator` (read-modify-write function)
 * must be supplied.  `mutator` is called with the file's current on-disk
 * content inside the exclusive lock, guaranteeing atomic read-modify-write.
 */
export interface WriteRequest {
  /** Unique request identifier (uuid). */
  id:          string;
  /** Isolated queue lane this write belongs to. */
  queueKey:    QueueKey;
  /** Absolute or project-relative file path to write. */
  filePath:    string;
  /** Static replacement content.  Mutually exclusive with `mutator`. */
  content?:    string;
  /**
   * Read-modify-write function.  Receives the current file content
   * (empty string if the file doesn't exist) and returns new content.
   * Executed inside the exclusive file lock — safe against concurrent readers.
   */
  mutator?:    (currentContent: string) => string | Promise<string>;
  /** Used for format-specific validation before commit. */
  fileType:    MemoryFileType;
  /** Logical owner name (e.g. "memory-store", "confidence-bridge"). */
  ownerId:     string;
  /** Active agent run id, or "system" for non-run writes. */
  runId:       string;
  /** Maximum retry attempts on transient failures (default: 3). */
  maxRetries:  number;
  /** Wall-clock timeout for the entire write including retries (ms, default: 30 000). */
  timeoutMs:   number;
  /** Epoch ms when this request was enqueued. */
  enqueuedAt:  number;
  /** Optional cancellation signal. */
  signal?:     AbortSignal;
}

// ── Write result ──────────────────────────────────────────────────────────────

export interface WriteResult {
  success:    boolean;
  requestId:  string;
  filePath:   string;
  durationMs: number;
  retries:    number;
  /** SHA-256 (truncated 16 hex) of the committed content. */
  checksum:   string;
  error?:     string;
}

// ── Queue internals ───────────────────────────────────────────────────────────

export interface QueueEntry {
  request: WriteRequest;
  resolve: (result: WriteResult) => void;
  reject:  (error: Error)         => void;
}

export interface ProjectWriteQueue {
  active:          boolean;
  pending:         QueueEntry[];
  processedTotal:  number;
  failedTotal:     number;
  lastActivityTs:  number;
}

export interface QueueStats {
  queueKey:        QueueKey;
  depth:           number;
  active:          boolean;
  processedTotal:  number;
  failedTotal:     number;
  lastActivityTs:  number;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:     boolean;
  checksum:  string;
  reason?:   string;
}

// ── Transaction ───────────────────────────────────────────────────────────────

export interface TransactionState {
  filePath:    string;
  tempPath:    string;
  backupPath:  string;
  content:     string;
  fileType:    MemoryFileType;
  ownerId:     string;
  runId:       string;
  lockId:      string | null;
  checksum:    string;
  rolledBack:  boolean;
}

// ── Recovery ──────────────────────────────────────────────────────────────────

export type RecoveryAction = "restored_from_temp" | "restored_from_backup" | "quarantined" | "none";

export interface RecoveryResult {
  action:   RecoveryAction;
  filePath: string;
  reason:   string;
}
