/**
 * rollback-consistency-validator.ts
 *
 * Validates that a rollback operation is safe and consistent before execution.
 *
 * Single responsibility: rollback safety checks.
 *
 * Rules enforced:
 *   1. Backup file must exist and be readable
 *   2. Backup checksum must match the stored pre-write checksum
 *   3. No active write lock on the target file during rollback
 *   4. Rollback is idempotent — re-running on an already-rolled-back file is safe
 */

import fs   from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { fileLockManager } from "../locks/file-lock-manager.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RollbackTarget {
  requestId:       string;
  filePath:        string;
  backupPath:      string;
  expectedChecksum?: string;   // sha256 of the pre-write content
  quantumRunId?:   string;
}

export interface RollbackValidation {
  safe:    boolean;
  reason:  string;
  code:    string;
}

export interface RollbackResult {
  success:   boolean;
  requestId: string;
  filePath:  string;
  reason:    string;
}

// ── Validator ─────────────────────────────────────────────────────────────────

class RollbackConsistencyValidator {
  /**
   * Validate that rollback for a given target is safe to proceed.
   * Must be called before any file restoration.
   */
  async validate(target: RollbackTarget): Promise<RollbackValidation> {
    // 1. Backup must exist
    const backupExists = await fileExists(target.backupPath);
    if (!backupExists) {
      return {
        safe:   false,
        reason: `Backup not found at "${target.backupPath}"`,
        code:   "BACKUP_MISSING",
      };
    }

    // 2. Lock check — rollback blocked if an active write is in progress
    const isLocked = fileLockManager.isLocked(target.filePath);
    const owner    = fileLockManager.getOwner(target.filePath);
    if (isLocked && owner && owner.runId !== target.quantumRunId) {
      return {
        safe:   false,
        reason: `File "${path.basename(target.filePath)}" has active write lock (holder run: ${owner.runId})`,
        code:   "LOCK_CONFLICT",
      };
    }

    // 3. Checksum validation (if expected checksum provided)
    if (target.expectedChecksum) {
      const backupContent = await fs.readFile(target.backupPath, "utf8");
      const actualChecksum = sha256(backupContent);

      if (actualChecksum !== target.expectedChecksum) {
        return {
          safe:   false,
          reason: `Backup checksum mismatch — expected ${target.expectedChecksum.slice(0, 8)}, got ${actualChecksum.slice(0, 8)}`,
          code:   "CHECKSUM_MISMATCH",
        };
      }
    }

    return { safe: true, reason: "all rollback safety checks passed", code: "OK" };
  }

  /**
   * Execute a safe rollback after validation passes.
   * Copies backup → target atomically via a temp file.
   */
  async execute(target: RollbackTarget): Promise<RollbackResult> {
    const validation = await this.validate(target);
    if (!validation.safe) {
      return { success: false, requestId: target.requestId, filePath: target.filePath, reason: validation.reason };
    }

    const tempPath = `${target.filePath}.rollback_tmp_${Date.now()}`;
    try {
      await fs.copyFile(target.backupPath, tempPath);
      await fs.rename(tempPath, target.filePath);
      return { success: true, requestId: target.requestId, filePath: target.filePath, reason: "rollback completed" };
    } catch (err) {
      await fs.unlink(tempPath).catch(() => {});
      return { success: false, requestId: target.requestId, filePath: target.filePath, reason: (err as Error).message };
    }
  }

  /**
   * Validate multiple rollback targets in parallel.
   * Returns only safe targets — unsafe ones are filtered out.
   */
  async filterSafe(targets: RollbackTarget[]): Promise<RollbackTarget[]> {
    const results = await Promise.all(
      targets.map(async t => ({ t, v: await this.validate(t) })),
    );
    return results.filter(r => r.v.safe).map(r => r.t);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fileExists(p: string): Promise<boolean> {
  return fs.access(p).then(() => true).catch(() => false);
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const rollbackConsistencyValidator = new RollbackConsistencyValidator();
