/**
 * orchestration-replay.ts
 *
 * Replay and checkpoint management for orchestration runs.
 * Enables deterministic re-execution from any saved phase checkpoint.
 */

import { v4 as uuidv4 } from "uuid";
import { snapshotContext } from "./orchestration-context.ts";
import { getState, setCheckpoint } from "./orchestration-state.ts";
import { emitOrchestrationCheckpoint } from "./orchestration-events.ts";
import type {
  OrchestrationCheckpoint,
  OrchestrationPhase,
} from "./orchestration-types.ts";

// ── Checkpoint store (in-memory, survives within a process) ───────────────────

const _checkpoints = new Map<string, OrchestrationCheckpoint>();
const _runCheckpoints = new Map<string, string[]>();  // runId → checkpointId[]

// ── Create checkpoint ─────────────────────────────────────────────────────────

export function captureCheckpoint(
  runId:     string,
  projectId: number,
  phase:     OrchestrationPhase,
): OrchestrationCheckpoint | null {
  const state = getState(runId);
  if (!state) return null;

  const checkpointId = `orch-cp-${uuidv4().slice(0, 8)}`;
  const contextSnap  = snapshotContext(runId);

  const cp: OrchestrationCheckpoint = {
    checkpointId,
    runId,
    projectId,
    phase,
    capturedAt:      Date.now(),
    contextSnapshot: contextSnap,
    stateSnapshot: {
      phase,
      status:       state.status,
      retryCount:   state.retryCount,
      phaseHistory: [...state.phaseHistory],
      score:        state.score,
    },
    replayable: true,
  };

  _checkpoints.set(checkpointId, cp);

  const list = _runCheckpoints.get(runId) ?? [];
  list.push(checkpointId);
  _runCheckpoints.set(runId, list);

  setCheckpoint(runId, checkpointId);
  emitOrchestrationCheckpoint({ runId, projectId, checkpointId, phase });

  console.log(`[orchestration-replay] Checkpoint captured: ${checkpointId} at phase=${phase}`);
  return cp;
}

// ── Restore checkpoint ────────────────────────────────────────────────────────

export function getCheckpoint(checkpointId: string): OrchestrationCheckpoint | undefined {
  return _checkpoints.get(checkpointId);
}

export function getLatestCheckpoint(runId: string): OrchestrationCheckpoint | undefined {
  const list = _runCheckpoints.get(runId) ?? [];
  if (list.length === 0) return undefined;
  return _checkpoints.get(list[list.length - 1]);
}

export function listCheckpoints(runId: string): OrchestrationCheckpoint[] {
  const list = _runCheckpoints.get(runId) ?? [];
  return list.map(id => _checkpoints.get(id)!).filter(Boolean);
}

// ── Replay plan ───────────────────────────────────────────────────────────────

export interface ReplayPlan {
  checkpointId:   string;
  resumePhase:    OrchestrationPhase;
  skipPhases:     OrchestrationPhase[];
  contextPatch:   Record<string, unknown>;
  replayable:     boolean;
  reason:         string;
}

export function buildReplayPlan(
  runId:       string,
  targetPhase: OrchestrationPhase,
): ReplayPlan | null {
  const cp = getLatestCheckpoint(runId);
  if (!cp || !cp.replayable) {
    return {
      checkpointId: "",
      resumePhase:  "observe",
      skipPhases:   [],
      contextPatch: {},
      replayable:   false,
      reason:       "No replayable checkpoint found — full replay from observe.",
    };
  }

  const PHASE_ORDER: OrchestrationPhase[] = [
    "observe", "analyze", "plan", "decompose",
    "route", "execute", "verify", "reflect",
    "score", "learn", "complete",
  ];

  const cpIdx     = PHASE_ORDER.indexOf(cp.phase);
  const targetIdx = PHASE_ORDER.indexOf(targetPhase);
  const skipPhases = cpIdx >= 0 && targetIdx > cpIdx
    ? PHASE_ORDER.slice(0, cpIdx + 1) as OrchestrationPhase[]
    : [];

  return {
    checkpointId: cp.checkpointId,
    resumePhase:  cp.phase,
    skipPhases,
    contextPatch: {},
    replayable:   true,
    reason:       `Replaying from checkpoint at phase=${cp.phase}`,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearCheckpoints(runId: string): void {
  const list = _runCheckpoints.get(runId) ?? [];
  list.forEach(id => _checkpoints.delete(id));
  _runCheckpoints.delete(runId);
}

export function checkpointStats(): { total: number; runs: number } {
  return { total: _checkpoints.size, runs: _runCheckpoints.size };
}
