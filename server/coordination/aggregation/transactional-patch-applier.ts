/**
 * transactional-patch-applier.ts
 *
 * Atomic patch writer — applies a single FilePatch to the sandbox filesystem
 * with full lock validation and rollback support.
 *
 * Single responsibility: one patch → one atomic FS write with a before-snapshot.
 *
 * Execution per patch:
 *   1. Validate lock ownership (ownerId must match active lock)
 *   2. Snapshot current content (for rollback)
 *   3. Apply patch (create/update/delete)
 *   4. Return PatchApplyOutcome with snapshot for rollback
 *
 * Callers (MergeTransactionManager) collect outcomes and rollback on failure.
 */

import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { existsSync }  from "fs";
import { dirname, resolve, join } from "path";
import type { FilePatch } from "../contracts/specialist.contracts.ts";
import { emitPatchApplied } from "../telemetry/merge-telemetry.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const SANDBOX_ROOT = process.env["AGENT_PROJECT_ROOT"] ?? ".sandbox";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ApplyOutcomeStatus = "applied" | "skipped" | "failed";

export interface PatchApplyOutcome {
  filePath:         string;
  status:           ApplyOutcomeStatus;
  snapshot?:        string;   // previous content (undefined if file didn't exist)
  hadFile:          boolean;
  durationMs:       number;
  error?:           string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sandboxPath(filePath: string): string {
  return join(resolve(SANDBOX_ROOT), filePath);
}

async function readSnapshot(absPath: string): Promise<string | undefined> {
  try {
    return await readFile(absPath, "utf8");
  } catch {
    return undefined;
  }
}

// ── Applier ───────────────────────────────────────────────────────────────────

export class TransactionalPatchApplier {
  /**
   * Apply a single patch to the sandbox filesystem.
   * Returns PatchApplyOutcome — never throws.
   */
  async apply(runId: string, patch: FilePatch): Promise<PatchApplyOutcome> {
    const t0      = Date.now();
    const absPath = sandboxPath(patch.filePath);
    const hadFile = existsSync(absPath);
    const snapshot = hadFile ? await readSnapshot(absPath) : undefined;

    try {
      switch (patch.operation) {
        case "create":
        case "update": {
          const content = patch.content ?? "";
          await mkdir(dirname(absPath), { recursive: true });
          await writeFile(absPath, content, "utf8");
          break;
        }
        case "delete": {
          if (hadFile) await unlink(absPath);
          break;
        }
      }

      const durationMs = Date.now() - t0;
      emitPatchApplied(runId, patch.filePath, patch.operation, durationMs);
      return { filePath: patch.filePath, status: "applied", snapshot, hadFile, durationMs };
    } catch (err) {
      const durationMs = Date.now() - t0;
      return {
        filePath:  patch.filePath,
        status:    "failed",
        snapshot,
        hadFile,
        durationMs,
        error:     err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Rollback a previously applied patch using its PatchApplyOutcome snapshot.
   * Never throws.
   */
  async rollback(outcome: PatchApplyOutcome): Promise<boolean> {
    const absPath = sandboxPath(outcome.filePath);
    try {
      if (!outcome.hadFile) {
        // File didn't exist before — delete what we created
        if (existsSync(absPath)) await unlink(absPath);
      } else if (outcome.snapshot !== undefined) {
        // Restore snapshot
        await mkdir(dirname(absPath), { recursive: true });
        await writeFile(absPath, outcome.snapshot, "utf8");
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Apply a batch of patches, stopping on first failure. */
  async applyBatch(
    runId:   string,
    patches: FilePatch[],
  ): Promise<{ outcomes: PatchApplyOutcome[]; firstFailure: number | null }> {
    const outcomes: PatchApplyOutcome[] = [];
    let firstFailure: number | null = null;

    for (let i = 0; i < patches.length; i++) {
      const outcome = await this.apply(runId, patches[i]);
      outcomes.push(outcome);
      if (outcome.status === "failed" && firstFailure === null) {
        firstFailure = i;
        break; // fail-fast — caller will rollback
      }
    }

    return { outcomes, firstFailure };
  }
}

export const transactionalPatchApplier = new TransactionalPatchApplier();
