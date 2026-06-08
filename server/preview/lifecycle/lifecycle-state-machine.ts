/**
 * lifecycle-state-machine.ts — Core state machine for preview lifecycle.
 * Delegates persistence to lifecycleService.
 * Emits events on every transition.
 */

import { lifecycleService }      from "../../services/preview/index.ts";
import type { PreviewLifecycleState, PreviewState } from "../domain/entities/preview-state.ts";
import type { PreviewLifecycleEvent }               from "../events/preview-events.ts";

type TransitionListener = (event: PreviewLifecycleEvent) => void;

class LifecycleStateMachine {
  private readonly listeners = new Set<TransitionListener>();

  on(listener: TransitionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async transition(
    projectId: number,
    to:        PreviewLifecycleState,
    message:   string,
    meta:      Record<string, unknown> = {},
  ): Promise<{ ok: boolean; state: PreviewState; error?: string }> {
    const result = await lifecycleService.transition(projectId, to, message, meta);

    if (result.ok) {
      this.emit({
        type:      "preview.lifecycle",
        projectId,
        state:     result.state.state,
        prevState: result.state.prevState,
        message:   result.state.message,
        meta:      result.state.meta,
        ts:        result.state.ts,
      });
    }

    return result;
  }

  async force(
    projectId: number,
    to:        PreviewLifecycleState,
    message:   string,
    meta:      Record<string, unknown> = {},
  ): Promise<PreviewState> {
    const state = await lifecycleService.forceTransition(projectId, to, message, meta);

    this.emit({
      type:      "preview.lifecycle",
      projectId,
      state:     state.state,
      prevState: state.prevState,
      message:   state.message,
      meta:      state.meta,
      ts:        state.ts,
    });

    return state;
  }

  async current(projectId: number): Promise<PreviewState> {
    return lifecycleService.getCurrentState(projectId);
  }

  async reset(projectId: number): Promise<PreviewState> {
    return this.force(projectId, "idle", "State machine reset.");
  }

  private emit(event: PreviewLifecycleEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* never crash on listener error */ }
    }
  }
}

export const stateMachine = new LifecycleStateMachine();
