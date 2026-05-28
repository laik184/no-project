/**
 * server/agents/coderx/memory/working-memory.ts
 *
 * Maintains active reasoning context, temporary execution memory,
 * and runtime task state for a CoderX run.
 * Pure in-process storage — no execution logic.
 */

import type { CodingTaskAnalysis, CodingPlan } from '../types/coderx.types.ts';
import { now } from '../utils/coding-utils.ts';

export interface WorkingMemoryEntry {
  readonly runId:      string;
  readonly createdAt:  Date;
  analysis?:           CodingTaskAnalysis;
  plan?:               CodingPlan;
  activeTaskId?:       string;
  completedTaskIds:    string[];
  failedTaskIds:       string[];
  scratchpad:          Record<string, unknown>;
}

const _memory = new Map<string, WorkingMemoryEntry>();

export const workingMemory = {

  init(runId: string): WorkingMemoryEntry {
    const entry: WorkingMemoryEntry = {
      runId,
      createdAt:        now(),
      completedTaskIds: [],
      failedTaskIds:    [],
      scratchpad:       {},
    };
    _memory.set(runId, entry);
    return entry;
  },

  get(runId: string): WorkingMemoryEntry | undefined {
    return _memory.get(runId);
  },

  setAnalysis(runId: string, analysis: CodingTaskAnalysis): void {
    const entry = _memory.get(runId);
    if (!entry) return;
    (entry as { analysis?: CodingTaskAnalysis }).analysis = analysis;
  },

  setPlan(runId: string, plan: CodingPlan): void {
    const entry = _memory.get(runId);
    if (!entry) return;
    (entry as { plan?: CodingPlan }).plan = plan;
  },

  setActiveTask(runId: string, taskId: string): void {
    const entry = _memory.get(runId);
    if (!entry) return;
    (entry as { activeTaskId?: string }).activeTaskId = taskId;
  },

  markTaskCompleted(runId: string, taskId: string): void {
    const entry = _memory.get(runId);
    if (!entry) return;
    if (!entry.completedTaskIds.includes(taskId)) {
      entry.completedTaskIds.push(taskId);
    }
    if ((entry as { activeTaskId?: string }).activeTaskId === taskId) {
      (entry as { activeTaskId?: string }).activeTaskId = undefined;
    }
  },

  markTaskFailed(runId: string, taskId: string): void {
    const entry = _memory.get(runId);
    if (!entry) return;
    if (!entry.failedTaskIds.includes(taskId)) {
      entry.failedTaskIds.push(taskId);
    }
  },

  write(runId: string, key: string, value: unknown): void {
    const entry = _memory.get(runId);
    if (!entry) return;
    entry.scratchpad[key] = value;
  },

  read(runId: string, key: string): unknown {
    return _memory.get(runId)?.scratchpad[key];
  },

  clear(runId: string): void {
    _memory.delete(runId);
  },
};
