/**
 * server/fail-closed/recovery/rollback-executor.ts
 *
 * RollbackExecutor — executes rollback operations to restore a prior checkpoint.
 *
 * Rollback strategies (in preference order):
 *   1. Git checkout to commit hash (if checkpoint has commitHash)
 *   2. Filesystem snapshot restore (future: from a snapshotted state)
 *   3. Hard fail — no rollback possible
 *
 * After any rollback, mandatory reverification is required.
 * The executor NEVER marks success — only restores state.
 *
 * INVARIANT: If rollback fails, system goes to HALTED (never silent continue).
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { existsSync } from "fs";
import type { Checkpoint } from "../contracts/types.ts";

const execFileAsync = promisify(execFile);

export type RollbackResult =
  | { ok: true;  strategy: string; detail: string }
  | { ok: false; reason: string; fatal: boolean };

export class RollbackExecutor {

  async execute(checkpoint: Checkpoint): Promise<RollbackResult> {
    // Strategy 1: Git checkout
    if (checkpoint.commitHash) {
      return this._gitRollback(checkpoint.workspacePath, checkpoint.commitHash);
    }

    // Strategy 2: No executable rollback available
    return {
      ok:     false,
      reason: `Checkpoint ${checkpoint.id} (${checkpoint.grade}) has no commit hash — git rollback unavailable`,
      fatal:  false, // Allow system to HALT rather than crash
    };
  }

  private async _gitRollback(
    workspacePath: string,
    commitHash: string,
  ): Promise<RollbackResult> {
    if (!existsSync(workspacePath)) {
      return { ok: false, reason: `Workspace path not found: ${workspacePath}`, fatal: true };
    }

    // Validate the hash looks like a git SHA
    if (!/^[0-9a-f]{7,40}$/i.test(commitHash)) {
      return { ok: false, reason: `Invalid commit hash: ${commitHash}`, fatal: true };
    }

    try {
      // Check if there are uncommitted changes
      const { stdout: statusOut } = await execFileAsync("git", [
        "--no-optional-locks", "status", "--porcelain",
      ], { cwd: workspacePath });

      if (statusOut.trim().length > 0) {
        // Stash changes before rollback to prevent data loss
        await execFileAsync("git", ["stash", "--include-untracked"], { cwd: workspacePath });
      }

      // Perform the checkout
      await execFileAsync("git", ["checkout", commitHash, "--", "."], {
        cwd: workspacePath,
      });

      return {
        ok:       true,
        strategy: "git-checkout",
        detail:   `Rolled back to commit ${commitHash.slice(0, 8)} in ${workspacePath}`,
      };
    } catch (err: any) {
      return {
        ok:     false,
        reason: `Git rollback failed: ${err?.message ?? String(err)}`,
        fatal:  false,
      };
    }
  }

  /**
   * Validates that the workspace is in a recoverable git state.
   * Returns the current HEAD commit hash if git is available.
   */
  async currentCommit(workspacePath: string): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync("git", [
        "--no-optional-locks", "rev-parse", "HEAD",
      ], { cwd: workspacePath });
      return stdout.trim().slice(0, 40) || null;
    } catch {
      return null;
    }
  }
}
