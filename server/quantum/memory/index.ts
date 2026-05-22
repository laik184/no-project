/**
 * server/quantum/memory/index.ts
 *
 * Public barrel for the Memory Write Safety System.
 * All external consumers import from here — never from subsystem files directly.
 */

// ── Primary queue facade (the ONLY authorised write path) ─────────────────────
export { memoryWriteQueue }     from "./memory-write-queue.ts";

// ── Transaction (used internally; exported for testing) ───────────────────────
export { executeTransaction }   from "./memory-transaction.ts";

// ── Validator ─────────────────────────────────────────────────────────────────
export { validateContent, computeChecksum, verifyChecksum } from "./memory-validator.ts";

// ── Recovery ──────────────────────────────────────────────────────────────────
export { recoverFile, recoverDirectory, cleanStaleBackups } from "./memory-recovery.ts";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  QueueKey,
  MemoryFileType,
  WriteRequest,
  WriteResult,
  QueueStats,
  ValidationResult,
  TransactionState,
  RecoveryResult,
  RecoveryAction,
} from "./memory-types.ts";

// ── Enqueue param type (for callers) ─────────────────────────────────────────
export type { EnqueueParams } from "./memory-write-queue.ts";
