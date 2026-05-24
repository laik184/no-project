/**
 * server/engine/swarm/swarm-lifecycle-manager.ts
 *
 * Manages swarm session lifecycle: open, phase transitions, cleanup.
 * Integrates with state store, telemetry, and shared memory.
 * Single responsibility: lifecycle coordination only.
 */

import type { SwarmSession, SwarmPhase, SwarmFinalResult } from "./swarm-types.ts";
import {
  createSession,
  setPhase,
  deleteSession,
} from "./swarm-state-store.ts";
import {
  emitPhaseChanged,
  emitSwarmCompleted,
  emitSwarmFailed,
} from "./swarm-telemetry.ts";
import {
  initContext,
  clearContext,
  clearAllLanes,
} from "./swarm-shared-memory.ts";
import { clearResults }   from "./swarm-result-aggregator.ts";
import { clearConflicts } from "./swarm-conflict-router.ts";
import { clearAll }       from "./swarm-priority-router.ts";
import { incrementCounter } from "../../orchestration/telemetry/orchestration-metrics.ts";

// ── Active session timeout registry ──────────────────────────────────────────

const _timeouts = new Map<string, ReturnType<typeof setTimeout>>();
const DEFAULT_SWARM_TIMEOUT_MS = 600_000; // 10 minutes

// ── Lifecycle hooks ───────────────────────────────────────────────────────────

type OpenHook    = (session: SwarmSession) => void;
type CloseHook   = (result: SwarmFinalResult) => void;
type FailHook    = (swarmId: string, reason: string) => void;
type PhaseHook   = (swarmId: string, phase: SwarmPhase) => void;

const _hooks = {
  onOpen:  [] as OpenHook[],
  onClose: [] as CloseHook[],
  onFail:  [] as FailHook[],
  onPhase: [] as PhaseHook[],
};

export function onSwarmOpen(hook: OpenHook): () => void {
  _hooks.onOpen.push(hook);
  return () => { _hooks.onOpen = _hooks.onOpen.filter(h => h !== hook); };
}
export function onSwarmClose(hook: CloseHook): () => void {
  _hooks.onClose.push(hook);
  return () => { _hooks.onClose = _hooks.onClose.filter(h => h !== hook); };
}
export function onSwarmFail(hook: FailHook): () => void {
  _hooks.onFail.push(hook);
  return () => { _hooks.onFail = _hooks.onFail.filter(h => h !== hook); };
}
export function onPhaseChange(hook: PhaseHook): () => void {
  _hooks.onPhase.push(hook);
  return () => { _hooks.onPhase = _hooks.onPhase.filter(h => h !== hook); };
}

// ── Core lifecycle ────────────────────────────────────────────────────────────

export function openSwarm(
  swarmId:      string,
  runId:        string,
  projectId:    number,
  goal:         string,
  timeoutMs:    number = DEFAULT_SWARM_TIMEOUT_MS,
): SwarmSession {
  const session = createSession(swarmId, runId, projectId, goal);
  initContext(swarmId, goal);

  incrementCounter("swarm.sessions.opened", {});

  // Global timeout guard
  const tid = setTimeout(() => {
    closeSwarmFailed(session, runId, projectId, `Swarm ${swarmId} timed out after ${timeoutMs}ms`);
  }, timeoutMs);
  _timeouts.set(swarmId, tid);

  for (const h of _hooks.onOpen) { try { h(session); } catch { /* non-fatal */ } }
  return session;
}

export function transitionPhase(
  session:   SwarmSession,
  runId:     string,
  projectId: number,
  phase:     SwarmPhase,
): void {
  setPhase(session.swarmId, phase);
  session.phase = phase;
  emitPhaseChanged(runId, projectId, session.swarmId, phase);
  for (const h of _hooks.onPhase) { try { h(session.swarmId, phase); } catch { /* non-fatal */ } }
}

export function closeSwarmSuccess(
  session:   SwarmSession,
  runId:     string,
  projectId: number,
  result:    SwarmFinalResult,
): void {
  _cleanup(session.swarmId);
  transitionPhase(session, runId, projectId, "completed");
  emitSwarmCompleted(runId, projectId, result);
  incrementCounter("swarm.sessions.completed", { success: "true" });
  for (const h of _hooks.onClose) { try { h(result); } catch { /* non-fatal */ } }
}

export function closeSwarmFailed(
  session:   SwarmSession,
  runId:     string,
  projectId: number,
  reason:    string,
): void {
  _cleanup(session.swarmId);
  transitionPhase(session, runId, projectId, "failed");
  emitSwarmFailed(runId, projectId, session.swarmId, reason);
  incrementCounter("swarm.sessions.completed", { success: "false" });
  for (const h of _hooks.onFail) { try { h(session.swarmId, reason); } catch { /* non-fatal */ } }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

function _cleanup(swarmId: string): void {
  const tid = _timeouts.get(swarmId);
  if (tid) { clearTimeout(tid); _timeouts.delete(swarmId); }
  clearAll(); // priority router slots
}

export function destroySwarm(swarmId: string): void {
  _cleanup(swarmId);
  clearResults(swarmId);
  clearConflicts(swarmId);
  clearAllLanes(swarmId);
  clearContext(swarmId);
  deleteSession(swarmId);
}
