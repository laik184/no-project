/**
 * server/agents/executor/recovery/rollback-manager.ts
 *
 * Safe rollback execution manager.
 * Tracks what files have been modified, provides checkpoint/restore primitives,
 * and coordinates with working-memory to revert workflow state.
 *
 * Does NOT call file tools directly — emits rollback events consumed by
 * higher-level recovery logic. Rollback scope: file-list | workflow | full.
 *
 * No direct tool imports. No execution.
 */

import { workingMemory }          from '../memory/working-memory.ts';
import { executionHistory }       from '../memory/execution-history.ts';
import { executionTimeline }      from '../telemetry/execution-timeline.ts';
import type { TaskKind }          from '../types/executor.types.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RollbackScope = 'files' | 'workflow' | 'full';

export interface RollbackCheckpoint {
  id:           string;
  runId:        string;
  taskId:       string;
  scope:        RollbackScope;
  files:        string[];            // file paths tracked before changes
  workflowState: Record<string, unknown>;
  ts:           number;
}

export interface RollbackResult {
  ok:       boolean;
  scope:    RollbackScope;
  files:    string[];
  reason?:  string;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _checkpoints = new Map<string, RollbackCheckpoint[]>();  // runId → checkpoints
let _seq = 0;

// ── API ───────────────────────────────────────────────────────────────────────

export const rollbackManager = {
  /**
   * Create a checkpoint before executing a task.
   * Call this BEFORE applying any changes.
   */
  createCheckpoint(
    runId:  string,
    taskId: string,
    scope:  RollbackScope = 'files',
  ): RollbackCheckpoint {
    const wm   = workingMemory.get(runId);
    const cp: RollbackCheckpoint = {
      id:    `cp_${++_seq}`,
      runId, taskId, scope,
      files: wm ? [...wm.modifiedFiles] : [],
      workflowState: {
        currentWorkflow: wm?.currentWorkflow,
        currentTaskId:   wm?.currentTaskId,
        currentStepId:   wm?.currentStepId,
      },
      ts: Date.now(),
    };
    const list = _checkpoints.get(runId) ?? [];
    list.push(cp);
    _checkpoints.set(runId, list);
    return cp;
  },

  /**
   * Get the most recent checkpoint for a run (or specific scope).
   */
  latestCheckpoint(runId: string, scope?: RollbackScope): RollbackCheckpoint | undefined {
    const list = _checkpoints.get(runId) ?? [];
    const filtered = scope ? list.filter((c) => c.scope === scope) : list;
    return filtered[filtered.length - 1];
  },

  /**
   * Rollback to a checkpoint.
   * Emits timeline events and restores working-memory state.
   * Returns a RollbackResult for the caller to act on (e.g. to issue tool calls).
   */
  rollback(
    runId:  string,
    kind:   TaskKind,
    reason: string,
    checkpointId?: string,
  ): RollbackResult {
    const list = _checkpoints.get(runId) ?? [];
    const cp   = checkpointId
      ? list.find((c) => c.id === checkpointId)
      : list[list.length - 1];

    executionTimeline.record(runId, 'rollback.started', `Rollback: ${reason}`);

    if (!cp) {
      executionTimeline.record(runId, 'rollback.completed', 'No checkpoint — no-op rollback');
      return { ok: true, scope: 'files', files: [], reason: 'No checkpoint found — nothing to roll back' };
    }

    // Restore working-memory workflow state
    workingMemory.update(runId, {
      currentWorkflow: cp.workflowState.currentWorkflow as string | undefined,
      currentTaskId:   cp.workflowState.currentTaskId   as string | undefined,
      currentStepId:   cp.workflowState.currentStepId   as string | undefined,
    });

    // Also restore the snapshot (scalar fields)
    workingMemory.restore(runId);

    // Identify files that were added after the checkpoint
    const wm          = workingMemory.get(runId);
    const newFiles    = wm ? [...wm.modifiedFiles].filter((f) => !cp.files.includes(f)) : [];

    executionHistory.recordExecution({
      runId,
      taskId:     cp.taskId,
      toolName:   'rollback',
      kind,
      outcome:    'success',
      retries:    0,
      durationMs: Date.now() - cp.ts,
      fixApplied: `rollback:${cp.scope}`,
    });

    executionTimeline.record(
      runId, 'rollback.completed',
      `Rolled back ${newFiles.length} file change(s) since checkpoint ${cp.id}`,
    );

    return { ok: true, scope: cp.scope, files: newFiles };
  },

  /**
   * Return the list of files modified since the latest checkpoint.
   */
  filesSinceCheckpoint(runId: string): string[] {
    const cp = this.latestCheckpoint(runId);
    const wm = workingMemory.get(runId);
    if (!wm) return [];
    if (!cp) return [...wm.modifiedFiles];
    return [...wm.modifiedFiles].filter((f) => !cp.files.includes(f));
  },

  listCheckpoints(runId: string): RollbackCheckpoint[] {
    return _checkpoints.get(runId) ?? [];
  },

  clear(runId: string): void { _checkpoints.delete(runId); },
  reset():     void { _checkpoints.clear(); _seq = 0; },
};
