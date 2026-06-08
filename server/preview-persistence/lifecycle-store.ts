/**
 * lifecycle-store.ts — In-memory store for lifecycle transition history.
 * Keeps a capped ring-buffer of recent transitions per project.
 * Imports ONLY from infrastructure/index.ts (none needed here — pure in-memory).
 */

import type { PreviewLifecycleState } from "../preview/domain/entities/preview-state.ts";

export interface LifecycleRecord {
  readonly projectId:  number;
  readonly from:       PreviewLifecycleState;
  readonly to:         PreviewLifecycleState;
  readonly message:    string;
  readonly meta:       Record<string, unknown>;
  readonly ts:         number;
}

const MAX_RECORDS_PER_PROJECT = 100;

// projectId → ring buffer of records
const history = new Map<number, LifecycleRecord[]>();

export const lifecycleStore = {
  append(record: LifecycleRecord): void {
    const buf = history.get(record.projectId) ?? [];
    buf.push(record);
    if (buf.length > MAX_RECORDS_PER_PROJECT) buf.shift();
    history.set(record.projectId, buf);
  },

  findByProjectId(projectId: number): LifecycleRecord[] {
    return history.get(projectId) ?? [];
  },

  findLast(projectId: number): LifecycleRecord | null {
    const buf = history.get(projectId);
    if (!buf || buf.length === 0) return null;
    return buf[buf.length - 1];
  },

  clearProject(projectId: number): void {
    history.delete(projectId);
  },

  findAll(): Map<number, LifecycleRecord[]> {
    return new Map(history);
  },
};
