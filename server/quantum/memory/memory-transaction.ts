/**
 * memory-transaction.ts
 *
 * Atomic write lifecycle for memory files.
 * Guarantees that every committed write is fully validated and fsync'd.
 * Any failure at any stage triggers a full rollback with telemetry.
 *
 * Transaction flow:
 *   1. Read current content (if mutator supplied)
 *   2. Acquire exclusive file lock
 *   3. Write to .tmp file via buffered fd
 *   4. fdatasync — flush OS buffer to storage
 *   5. Validate format + checksum
 *   6. Atomic rename .tmp → target
 *   7. Verify committed content checksum
 *   8. Release lock
 *
 * On any failure: delete temp, restore backup, release lock, emit rollback.
 */

import fs   from "fs/promises";
import path from "path";

import { fileLockManager }    from "../locks/index.ts";
import { validateContent, computeChecksum } from "./memory-validator.ts";
import {
  emitLockWait, emitLockAcquired, emitLockReleased,
  emitRollback,
} from "./memory-telemetry.ts";
import type { TransactionState, MemoryFileType } from "./memory-types.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCK_TTL_MS    = 30_000;
const LOCK_RETRIES   = 6;
const LOCK_DELAY_MS  = 300;

// ── Public API ────────────────────────────────────────────────────────────────

export interface TransactionOptions {
  requestId:  string;
  filePath:   string;
  content?:   string;
  mutator?:   (current: string) => string | Promise<string>;
  fileType:   MemoryFileType;
  ownerId:    string;
  runId:      string;
}

export interface TransactionResult {
  checksum: string;
}

/**
 * Execute one atomic write transaction.
 * Throws on validation failure, lock timeout, or I/O error.
 * Always releases the lock and cleans up temp files on exit.
 */
export async function executeTransaction(
  opts: TransactionOptions,
): Promise<TransactionResult> {
  const { requestId, filePath, fileType, ownerId, runId } = opts;
  const tempPath   = filePath + ".tmp";
  const backupPath = filePath + ".bak";

  const state: TransactionState = {
    filePath,
    tempPath,
    backupPath,
    content:    "",
    fileType,
    ownerId,
    runId,
    lockId:     null,
    checksum:   "",
    rolledBack: false,
  };

  try {
    // ── Step 1: resolve content ────────────────────────────────────────────────
    if (opts.mutator) {
      const current = await readCurrentSafe(filePath);
      state.content = await opts.mutator(current);
    } else if (opts.content !== undefined) {
      state.content = opts.content;
    } else {
      throw new Error("TransactionOptions must provide either content or mutator");
    }

    // ── Step 2: acquire lock ───────────────────────────────────────────────────
    emitLockWait(requestId, filePath, ownerId, runId);

    const lockResult = await fileLockManager.acquire(filePath, ownerId, runId, {
      ttlMs:        LOCK_TTL_MS,
      maxRetries:   LOCK_RETRIES,
      retryDelayMs: LOCK_DELAY_MS,
    });

    if (!lockResult.success || !lockResult.lockId) {
      throw new Error(
        `Failed to acquire lock on ${filePath}: ${lockResult.failureReason ?? "unknown"}`,
      );
    }

    state.lockId = lockResult.lockId;
    emitLockAcquired(requestId, filePath, ownerId, runId, state.lockId);

    // ── Step 3: backup current file (best-effort) ──────────────────────────────
    await backupCurrentSafe(filePath, backupPath);

    // ── Step 4: write + fsync temp file ───────────────────────────────────────
    await ensureParentDir(tempPath);
    const fd = await fs.open(tempPath, "w");
    try {
      await fd.write(state.content, null, "utf-8");
      await fd.datasync();
    } finally {
      await fd.close();
    }

    // ── Step 5: validate temp content ─────────────────────────────────────────
    const validation = validateContent(state.content, fileType);
    if (!validation.valid) {
      throw new Error(`Validation failed for ${filePath}: ${validation.reason}`);
    }
    state.checksum = validation.checksum;

    // ── Step 6: atomic rename tmp → target ────────────────────────────────────
    await fs.rename(tempPath, filePath);

    // ── Step 7: verify committed content ──────────────────────────────────────
    const committed     = await fs.readFile(filePath, "utf-8");
    const committedSum  = computeChecksum(committed);
    if (committedSum !== state.checksum) {
      throw new Error(
        `Post-commit checksum mismatch on ${filePath}: expected ${state.checksum}, got ${committedSum}`,
      );
    }

    return { checksum: state.checksum };

  } catch (err) {
    // ── Rollback ───────────────────────────────────────────────────────────────
    state.rolledBack = true;
    const reason = (err as Error).message;
    emitRollback(requestId, filePath, ownerId, runId, reason);
    await rollback(state);
    throw err;

  } finally {
    // ── Always release lock ────────────────────────────────────────────────────
    if (state.lockId) {
      fileLockManager.release(state.lockId, ownerId);
      emitLockReleased(requestId, filePath, ownerId, runId, state.lockId);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readCurrentSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

async function backupCurrentSafe(filePath: string, backupPath: string): Promise<void> {
  try {
    await fs.copyFile(filePath, backupPath);
  } catch {
    // File may not exist yet — backup is best-effort
  }
}

async function rollback(state: TransactionState): Promise<void> {
  // Remove temp file if it exists
  try { await fs.unlink(state.tempPath); } catch { /* already gone */ }

  // Restore backup if present and target is missing or corrupt
  try {
    await fs.access(state.backupPath);
    await fs.copyFile(state.backupPath, state.filePath);
  } catch { /* no backup available — leave as-is */ }
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}
