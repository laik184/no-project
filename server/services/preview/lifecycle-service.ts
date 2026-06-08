/**
 * lifecycle-service.ts — Business logic for preview lifecycle state transitions.
 * Imports ONLY from repositories/preview/index.ts.
 */

import {
  previewRepository,
  lifecycleRepository,
  makeLifecycleRecord,
} from "../../repositories/preview/index.ts";
import {
  createPreviewState,
  transitionPreviewState,
} from "../../preview/domain/entities/preview-state.ts";
import type { PreviewLifecycleState, PreviewState } from "../../preview/domain/entities/preview-state.ts";

// ── Valid transition table ────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<PreviewLifecycleState, PreviewLifecycleState[]> = {
  idle:         ["building", "installing", "starting"],
  building:     ["installing", "starting", "crashed", "idle"],
  installing:   ["building", "starting", "crashed", "idle"],
  starting:     ["verifying", "ready", "crashed", "restarting", "idle"],
  verifying:    ["ready", "crashed", "starting"],
  restarting:   ["starting", "verifying", "crashed", "idle"],
  updating:     ["starting", "restarting", "hot_reloading", "crashed", "ready"],
  refreshing:   ["ready", "crashed"],
  hot_reloading:["ready", "crashed"],
  self_healing: ["debugging", "patching", "crashed", "ready"],
  debugging:    ["self_healing", "patching", "crashed", "ready"],
  patching:     ["starting", "verifying", "crashed", "ready"],
  ready:        ["restarting", "updating", "refreshing", "hot_reloading", "crashed",
                 "self_healing", "debugging", "building", "idle"],
  crashed:      ["restarting", "self_healing", "debugging", "idle", "building"],
  reconnecting: ["idle", "ready", "crashed"],
};

export class LifecycleService {
  async getOrCreate(projectId: number): Promise<PreviewState> {
    const existing = await previewRepository.findState(projectId);
    if (existing) return existing;
    const state = createPreviewState(projectId);
    await previewRepository.saveState(state);
    return state;
  }

  async transition(
    projectId: number,
    to:        PreviewLifecycleState,
    message:   string,
    meta:      Record<string, unknown> = {},
  ): Promise<{ ok: boolean; state: PreviewState; error?: string }> {
    const current = await this.getOrCreate(projectId);
    const allowed = VALID_TRANSITIONS[current.state] ?? [];

    if (!allowed.includes(to)) {
      return {
        ok:    false,
        state: current,
        error: `Invalid transition: ${current.state} → ${to}`,
      };
    }

    const next = transitionPreviewState(current, to, message, meta);
    await previewRepository.saveState(next);
    await lifecycleRepository.append(
      makeLifecycleRecord(projectId, current.state, to, message, meta),
    );

    return { ok: true, state: next };
  }

  async forceTransition(
    projectId: number,
    to:        PreviewLifecycleState,
    message:   string,
    meta:      Record<string, unknown> = {},
  ): Promise<PreviewState> {
    const current = await this.getOrCreate(projectId);
    const next    = transitionPreviewState(current, to, message, meta);
    await previewRepository.saveState(next);
    await lifecycleRepository.append(
      makeLifecycleRecord(projectId, current.state, to, message, meta),
    );
    return next;
  }

  async getCurrentState(projectId: number): Promise<PreviewState> {
    return this.getOrCreate(projectId);
  }

  async getHistory(projectId: number) {
    return lifecycleRepository.findByProjectId(projectId);
  }

  async reset(projectId: number): Promise<PreviewState> {
    return this.forceTransition(projectId, "idle", "Preview reset.");
  }
}

export const lifecycleService = new LifecycleService();
