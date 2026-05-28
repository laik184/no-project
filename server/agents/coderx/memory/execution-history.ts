/**
 * server/agents/coderx/memory/execution-history.ts
 *
 * Stores execution history, retry history, and snapshots per run.
 * Pure in-process storage — no execution logic.
 */

import type { CodingTaskOutput, CodingTaskKind } from '../types/coderx.types.ts';
import { now } from '../utils/coding-utils.ts';

export interface ExecutionSnapshot {
  readonly snapshotId: string;
  readonly runId:      string;
  readonly timestamp:  Date;
  readonly stepId:     string;
  readonly taskId:     string;
  readonly toolName:   string;
  readonly ok:         boolean;
  readonly durationMs: number;
  readonly error?:     string;
  readonly output?:    unknown;
}

export interface RetryHistoryEntry {
  readonly stepId:    string;
  readonly taskId:    string;
  readonly runId:     string;
  readonly attempt:   number;
  readonly timestamp: Date;
  readonly error:     string;
}

const _snapshots    = new Map<string, ExecutionSnapshot[]>();
const _retries      = new Map<string, RetryHistoryEntry[]>();
const _taskOutputs  = new Map<string, CodingTaskOutput[]>();

let _snapshotSeq = 0;

export const executionHistory = {

  recordSnapshot(
    runId:      string,
    stepId:     string,
    taskId:     string,
    toolName:   string,
    ok:         boolean,
    durationMs: number,
    output?:    unknown,
    error?:     string,
  ): void {
    const snapshot: ExecutionSnapshot = {
      snapshotId: `snap_${++_snapshotSeq}`,
      runId, stepId, taskId, toolName, ok, durationMs,
      timestamp: now(),
      output, error,
    };
    const list = _snapshots.get(runId) ?? [];
    list.push(snapshot);
    _snapshots.set(runId, list);
  },

  recordRetry(
    runId:   string,
    stepId:  string,
    taskId:  string,
    attempt: number,
    error:   string,
  ): void {
    const entry: RetryHistoryEntry = {
      stepId, taskId, runId, attempt, error, timestamp: now(),
    };
    const list = _retries.get(runId) ?? [];
    list.push(entry);
    _retries.set(runId, list);
  },

  recordTaskOutput(runId: string, output: CodingTaskOutput): void {
    const list = _taskOutputs.get(runId) ?? [];
    list.push(output);
    _taskOutputs.set(runId, list);
  },

  getSnapshots(runId: string): ExecutionSnapshot[] {
    return _snapshots.get(runId) ?? [];
  },

  getRetries(runId: string): RetryHistoryEntry[] {
    return _retries.get(runId) ?? [];
  },

  getTaskOutputs(runId: string): CodingTaskOutput[] {
    return _taskOutputs.get(runId) ?? [];
  },

  getRetryCountForStep(runId: string, stepId: string): number {
    return (_retries.get(runId) ?? []).filter((r) => r.stepId === stepId).length;
  },

  clearRun(runId: string): void {
    _snapshots.delete(runId);
    _retries.delete(runId);
    _taskOutputs.delete(runId);
  },
};
