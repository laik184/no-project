/**
 * lifecycle-repository.ts — Lifecycle history repository.
 * Imports ONLY from preview-persistence/index.ts.
 */

import { lifecycleStore } from "../../preview-persistence/index.ts";
import type { LifecycleRecord } from "../../preview-persistence/index.ts";
import type { PreviewLifecycleState } from "../../preview/domain/entities/preview-state.ts";

export interface ILifecycleRepository {
  append(record: LifecycleRecord): Promise<void>;
  findByProjectId(projectId: number): Promise<LifecycleRecord[]>;
  findLast(projectId: number): Promise<LifecycleRecord | null>;
  clearProject(projectId: number): Promise<void>;
}

class LifecycleRepository implements ILifecycleRepository {
  async append(record: LifecycleRecord): Promise<void> {
    lifecycleStore.append(record);
  }

  async findByProjectId(projectId: number): Promise<LifecycleRecord[]> {
    return lifecycleStore.findByProjectId(projectId);
  }

  async findLast(projectId: number): Promise<LifecycleRecord | null> {
    return lifecycleStore.findLast(projectId);
  }

  async clearProject(projectId: number): Promise<void> {
    lifecycleStore.clearProject(projectId);
  }
}

export const lifecycleRepository = new LifecycleRepository();

// ── Convenience factory for LifecycleRecord ───────────────────────────────────

export function makeLifecycleRecord(
  projectId: number,
  from:      PreviewLifecycleState,
  to:        PreviewLifecycleState,
  message:   string,
  meta:      Record<string, unknown> = {},
): LifecycleRecord {
  return Object.freeze({ projectId, from, to, message, meta, ts: Date.now() });
}
