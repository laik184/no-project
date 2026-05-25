/**
 * merge-transaction-manager.ts
 *
 * Transactional orchestrator for patch application.
 * Single responsibility: begin/commit/rollback semantics over a set of patches.
 *
 * Transaction lifecycle:
 *   begin()  → creates a transaction record, validates all patches via barrier
 *   commit() → applies patches via TransactionalPatchApplier, records in ReplayJournal
 *   rollback() → reverses all applied patches in reverse order
 *
 * Fail-closed: any patch failure during commit triggers full rollback of applied patches.
 * Checkpoint: every committed transaction is checkpointed in memory for replay.
 */

import { v4 as uuidv4 } from "uuid";
import type { FilePatch } from "../contracts/specialist.contracts.ts";
import { patchValidationBarrier } from "./patch-validation-barrier.ts";
import { transactionalPatchApplier, type PatchApplyOutcome } from "./transactional-patch-applier.ts";
import { replayJournal } from "./replay-journal.ts";
import { emitTxBegin, emitTxCommit, emitTxRollback } from "../telemetry/merge-telemetry.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TxStatus = "pending" | "committed" | "rolled_back" | "failed";

export interface MergeTransaction {
  txId:       string;
  runId:      string;
  patches:    FilePatch[];
  status:     TxStatus;
  outcomes:   PatchApplyOutcome[];
  createdAt:  number;
  settledAt?: number;
}

export interface CommitResult {
  txId:        string;
  success:     boolean;
  applied:     number;
  rolledBack:  number;
  reason?:     string;
}

// ── Manager ───────────────────────────────────────────────────────────────────

export class MergeTransactionManager {
  private readonly _transactions = new Map<string, MergeTransaction>();

  /**
   * Begin a new merge transaction.
   * Validates all patches through the barrier — rejects invalid patches before apply.
   * Returns txId and the count of valid patches queued.
   */
  begin(runId: string, patches: FilePatch[]): {
    txId:     string;
    queued:   number;
    rejected: number;
  } {
    const txId = `tx-${uuidv4().slice(0, 8)}`;

    const barrier = patchValidationBarrier.validateAll(runId, patches);
    const validPatches = barrier.valid.map(r => r.patch);

    const tx: MergeTransaction = {
      txId,
      runId,
      patches:   validPatches,
      status:    "pending",
      outcomes:  [],
      createdAt: Date.now(),
    };

    this._transactions.set(txId, tx);
    emitTxBegin(runId, txId, validPatches.length);

    return {
      txId,
      queued:   validPatches.length,
      rejected: barrier.rejected.length,
    };
  }

  /**
   * Commit the transaction — apply all queued patches.
   * On any patch failure: rollback all already-applied patches.
   */
  async commit(txId: string): Promise<CommitResult> {
    const tx = this._transactions.get(txId);
    if (!tx) {
      return { txId, success: false, applied: 0, rolledBack: 0, reason: "transaction_not_found" };
    }

    if (tx.status !== "pending") {
      return { txId, success: false, applied: 0, rolledBack: 0, reason: `invalid_status:${tx.status}` };
    }

    const t0 = Date.now();
    const { outcomes, firstFailure } = await transactionalPatchApplier.applyBatch(tx.runId, tx.patches);
    tx.outcomes = outcomes;

    if (firstFailure !== null) {
      // Rollback all applied patches in reverse order
      const rolledBack = await this._rollbackOutcomes(outcomes.slice(0, firstFailure));
      tx.status    = "rolled_back";
      tx.settledAt = Date.now();

      const failedOutcome = outcomes[firstFailure];
      emitTxRollback(tx.runId, txId, failedOutcome?.error ?? "apply_failed", rolledBack);
      return { txId, success: false, applied: firstFailure, rolledBack, reason: failedOutcome?.error };
    }

    // All applied — journal and commit
    replayJournal.recordBatch(tx.runId, txId, tx.patches, "TRANSACTIONAL");
    tx.status    = "committed";
    tx.settledAt = Date.now();

    const durationMs = Date.now() - t0;
    emitTxCommit(tx.runId, txId, outcomes.length, durationMs);

    return { txId, success: true, applied: outcomes.length, rolledBack: 0 };
  }

  /** Explicitly rollback a pending transaction (before commit). */
  async abort(txId: string): Promise<number> {
    const tx = this._transactions.get(txId);
    if (!tx || tx.status !== "pending") return 0;
    const rolledBack = await this._rollbackOutcomes(tx.outcomes);
    tx.status    = "rolled_back";
    tx.settledAt = Date.now();
    emitTxRollback(tx.runId, txId, "explicit_abort", rolledBack);
    return rolledBack;
  }

  /** Get a transaction by ID. */
  get(txId: string): MergeTransaction | undefined {
    return this._transactions.get(txId);
  }

  private async _rollbackOutcomes(outcomes: PatchApplyOutcome[]): Promise<number> {
    let count = 0;
    for (const outcome of [...outcomes].reverse()) {
      if (outcome.status === "applied") {
        const ok = await transactionalPatchApplier.rollback(outcome);
        if (ok) count++;
      }
    }
    return count;
  }
}

export const mergeTransactionManager = new MergeTransactionManager();
