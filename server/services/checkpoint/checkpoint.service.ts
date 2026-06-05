/**
 * server/services/checkpoint/checkpoint.service.ts
 *
 * Checkpoint management: create (git commit snapshot) and restore.
 * Uses git under the hood to snapshot project state.
 *
 * Dependency rule:
 *   Tool → CheckpointService (this) → gitService → child_process (infra)
 */

import { gitService } from '../git/index.ts';

export interface CheckpointEntry {
  sha:       string;
  label:     string;
  createdAt: number;
}

export interface CreateCheckpointResult {
  ok:     boolean;
  entry?: CheckpointEntry;
  error?: string;
}

export interface RestoreCheckpointResult {
  ok:     boolean;
  error?: string;
}

class CheckpointService {
  private readonly history: CheckpointEntry[] = [];

  async create(label: string): Promise<CreateCheckpointResult> {
    const msg    = `[checkpoint] ${label}`;
    const result = await gitService.commit(msg);
    if (!result.ok || !result.sha) {
      return { ok: false, error: result.error ?? 'Commit failed — no SHA returned.' };
    }
    const entry: CheckpointEntry = {
      sha:       result.sha,
      label,
      createdAt: Date.now(),
    };
    this.history.push(entry);
    return { ok: true, entry };
  }

  async restore(sha: string): Promise<RestoreCheckpointResult> {
    const result = await gitService.restore(sha);
    return { ok: result.ok, error: result.error };
  }

  list(): ReadonlyArray<CheckpointEntry> {
    return [...this.history];
  }

  find(sha: string): CheckpointEntry | undefined {
    return this.history.find((e) => e.sha.startsWith(sha));
  }
}

export const checkpointService = new CheckpointService();
