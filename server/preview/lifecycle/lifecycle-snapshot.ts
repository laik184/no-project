/**
 * lifecycle-snapshot.ts — Generates lifecycle snapshots for API responses.
 */

import { lifecycleService } from "../../services/preview/index.ts";
import type { PreviewState } from "../domain/entities/preview-state.ts";

export interface LifecycleApiSnapshot {
  projectId:  number;
  state:      string;
  prevState:  string;
  message:    string;
  meta:       Record<string, unknown>;
  ts:         number;
  running:    boolean;
  port:       number | null;
}

const RUNNING_STATES = new Set(["starting", "verifying", "ready", "hot_reloading", "refreshing"]);

export async function buildLifecycleSnapshot(
  projectId: number,
  port:      number | null = null,
): Promise<LifecycleApiSnapshot> {
  const state = await lifecycleService.getCurrentState(projectId);
  return stateToSnapshot(state, port);
}

export function stateToSnapshot(
  state: PreviewState,
  port:  number | null = null,
): LifecycleApiSnapshot {
  return {
    projectId: state.projectId,
    state:     state.state,
    prevState: state.prevState,
    message:   state.message,
    meta:      state.meta,
    ts:        state.ts,
    running:   RUNNING_STATES.has(state.state),
    port,
  };
}

export async function buildAllSnapshots(): Promise<LifecycleApiSnapshot[]> {
  const { previewRepository } = await import("../../repositories/preview/index.ts");
  const states = await previewRepository.findAllStates();
  return states.map(s => stateToSnapshot(s));
}
