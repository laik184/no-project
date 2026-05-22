/**
 * mode-transition-manager.ts
 *
 * Executes safe mode transitions: captures runtime state snapshot,
 * preserves checkpoints, updates orchestration state, and emits telemetry.
 * INVARIANT: no execution loss — runId, telemetry, and checkpoints are preserved.
 */

import { v4 as uuid }            from "uuid";
import type { OrchestrationMode, OrchestrationContext, OrchestrationState } from "../core/orchestration-types.ts";
import type { ModeTransitionRecord, RuntimeMetricsSnapshot } from "./reroute-types.ts";
import {
  telemetryTransitionStarted,
  telemetryTransitionCompleted,
  telemetryTransitionFailed,
} from "./reroute-telemetry.ts";

// ── Transition store ──────────────────────────────────────────────────────────
// runId → latest transition record

const _transitions = new Map<string, ModeTransitionRecord>();

// ── State snapshot store ──────────────────────────────────────────────────────
// runId → frozen context/state snapshot (for replay safety)

const _snapshots = new Map<string, {
  ctx:   Partial<OrchestrationContext>;
  state: Partial<OrchestrationState>;
  ts:    number;
}>();

// ── Transition executor ───────────────────────────────────────────────────────

export interface TransitionInput {
  runId:       string;
  ctx:         OrchestrationContext;
  state:       OrchestrationState;
  fromMode:    OrchestrationMode;
  toMode:      OrchestrationMode;
  reason:      string;
  metrics:     RuntimeMetricsSnapshot;
}

export interface TransitionResult {
  success:     boolean;
  record:      ModeTransitionRecord;
  updatedCtx:  OrchestrationContext;
  error?:      string;
}

export async function executeTransition(input: TransitionInput): Promise<TransitionResult> {
  const { runId, ctx, state, fromMode, toMode, reason } = input;
  const transitionId = uuid();
  const t0           = Date.now();

  const record: ModeTransitionRecord = {
    transitionId,
    runId,
    fromMode,
    toMode,
    outcome:     "success",
    reason,
    triggeredAt: t0,
  };

  telemetryTransitionStarted(record);

  try {
    // Step 1: Capture runtime snapshot BEFORE transition
    _captureSnapshot(runId, ctx, state);

    // Step 2: Build updated context (preserves all fields, only mode changes)
    const updatedCtx: OrchestrationContext = { ...ctx, mode: toMode };

    // Step 3: Record checkpoint reference if available
    const checkpointId = state.checkpointId ?? undefined;

    // Step 4: Finalize record
    const completedRecord: ModeTransitionRecord = {
      ...record,
      outcome:      "success",
      completedAt:  Date.now(),
      durationMs:   Date.now() - t0,
      checkpointId,
    };

    _transitions.set(runId, completedRecord);
    telemetryTransitionCompleted(completedRecord);

    console.info(
      `[mode-transition] ${runId}: ${fromMode} → ${toMode} ` +
      `dur=${completedRecord.durationMs}ms checkpoint=${checkpointId ?? "none"}`,
    );

    return { success: true, record: completedRecord, updatedCtx };

  } catch (err) {
    const errMsg = (err as Error).message;
    const failedRecord: ModeTransitionRecord = {
      ...record,
      outcome:     "failed",
      completedAt: Date.now(),
      durationMs:  Date.now() - t0,
    };
    _transitions.set(runId, failedRecord);
    telemetryTransitionFailed(failedRecord, errMsg);

    console.error(`[mode-transition] FAILED run=${runId}: ${errMsg}`);
    return { success: false, record: failedRecord, updatedCtx: ctx, error: errMsg };
  }
}

// ── State snapshot ────────────────────────────────────────────────────────────

function _captureSnapshot(
  runId: string,
  ctx:   OrchestrationContext,
  state: OrchestrationState,
): void {
  _snapshots.set(runId, {
    ctx:   { ...ctx },
    state: { ...state },
    ts:    Date.now(),
  });
}

export function getSnapshot(runId: string) {
  return _snapshots.get(runId);
}

export function getTransition(runId: string): ModeTransitionRecord | undefined {
  return _transitions.get(runId);
}

// ── Escalation count tracker ──────────────────────────────────────────────────
// runId → { count, lastAt }

const _escalations = new Map<string, { count: number; lastAt: number }>();

export function recordEscalation(runId: string): void {
  const entry = _escalations.get(runId) ?? { count: 0, lastAt: 0 };
  _escalations.set(runId, { count: entry.count + 1, lastAt: Date.now() });
}

export function getEscalationInfo(runId: string): { count: number; lastAt: number } {
  return _escalations.get(runId) ?? { count: 0, lastAt: 0 };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearRun(runId: string): void {
  _transitions.delete(runId);
  _snapshots.delete(runId);
  _escalations.delete(runId);
}
