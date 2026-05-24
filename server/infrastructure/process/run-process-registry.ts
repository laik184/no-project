/**
 * server/infrastructure/process/run-process-registry.ts
 *
 * RunProcessRegistry — run-scoped process ownership layer.
 *
 * Responsibilities:
 *   - Track which processes belong to which runId (not just projectId)
 *   - Prevent cross-run process ownership leakage
 *   - Crash-safe cleanup: kill all owned processes when a run terminates
 *   - Deterministic ownership: one process belongs to exactly one run
 *   - Emit lifecycle telemetry on all process transitions
 *
 * Single responsibility: run → process ownership mapping. No spawning logic.
 */

import { bus }  from "../events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RunProcess {
  readonly pid:       number;
  readonly runId:     string;
  readonly projectId: number;
  readonly port?:     number;
  readonly startedAt: number;
  status:             RunProcessStatus;
}

export type RunProcessStatus = "running" | "stopped" | "crashed";

export interface OwnershipConflict {
  pid:            number;
  existingRunId:  string;
  claimingRunId:  string;
}

// ── Registry ──────────────────────────────────────────────────────────────────

const _byPid   = new Map<number, RunProcess>();             // pid → RunProcess
const _byRun   = new Map<string, Set<number>>();            // runId → Set<pid>
const _byProj  = new Map<number, Map<string, Set<number>>>(); // projectId → runId → Set<pid>

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emit(runId: string, projectId: number, eventType: string, payload: Record<string, unknown>): void {
  bus.emit("agent.event", {
    runId, projectId,
    phase: "run-process-registry",
    agentName: "run-process-registry",
    eventType, payload,
    ts: Date.now(),
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a process as owned by a specific run.
 * Returns a conflict descriptor if the PID is already owned by a different run.
 */
export function registerProcess(
  pid:       number,
  runId:     string,
  projectId: number,
  port?:     number,
): OwnershipConflict | null {
  const existing = _byPid.get(pid);
  if (existing && existing.runId !== runId) {
    const conflict: OwnershipConflict = {
      pid, existingRunId: existing.runId, claimingRunId: runId,
    };
    emit(runId, projectId, "conflict.detected", { resource: "pid", ...conflict });
    return conflict;
  }

  const entry: RunProcess = {
    pid, runId, projectId, port,
    startedAt: Date.now(),
    status:    "running",
  };
  _byPid.set(pid, entry);

  const runSet = _byRun.get(runId) ?? new Set();
  runSet.add(pid);
  _byRun.set(runId, runSet);

  const projMap = _byProj.get(projectId) ?? new Map();
  const projRunSet = projMap.get(runId) ?? new Set();
  projRunSet.add(pid);
  projMap.set(runId, projRunSet);
  _byProj.set(projectId, projMap);

  emit(runId, projectId, "runtime.spawned", { pid, port, ownedByRun: runSet.size });
  return null;
}

/** Update status of a tracked process. */
export function updateStatus(pid: number, status: RunProcessStatus): void {
  const entry = _byPid.get(pid);
  if (!entry) return;
  entry.status = status;
  const eventType = status === "crashed" ? "runtime.failed" : `process.${status}`;
  emit(entry.runId, entry.projectId, eventType, { pid, status });
}

/** Deregister a process (clean exit). */
export function deregisterProcess(pid: number): void {
  const entry = _byPid.get(pid);
  if (!entry) return;
  _byPid.delete(pid);
  _byRun.get(entry.runId)?.delete(pid);
  _byProj.get(entry.projectId)?.get(entry.runId)?.delete(pid);
  emit(entry.runId, entry.projectId, "process.stopped", { pid });
}

/**
 * Kill all processes owned by a run (crash-safe teardown).
 * Uses SIGTERM first, then SIGKILL after 2s.
 */
export function terminateRunProcesses(runId: string): void {
  const pids = Array.from(_byRun.get(runId) ?? []);
  for (const pid of pids) {
    const entry = _byPid.get(pid);
    if (!entry || entry.status !== "running") continue;
    try { process.kill(pid, "SIGTERM"); } catch {}
    setTimeout(() => {
      try {
        if (_byPid.has(pid)) process.kill(pid, "SIGKILL");
      } catch {}
      deregisterProcess(pid);
    }, 2_000);
    emit(runId, entry.projectId, "runtime.failed", { pid, reason: "run-terminated" });
  }
  _byRun.delete(runId);
}

/** Get all processes owned by a run. */
export function getRunProcesses(runId: string): RunProcess[] {
  const pids = Array.from(_byRun.get(runId) ?? []);
  return pids.map(pid => _byPid.get(pid)).filter(Boolean) as RunProcess[];
}

/** Get the single running process for a project+run combo (if any). */
export function getActiveProcess(runId: string): RunProcess | undefined {
  return getRunProcesses(runId).find(p => p.status === "running");
}

/** Check process ownership. */
export function getOwner(pid: number): string | undefined {
  return _byPid.get(pid)?.runId;
}

/** All tracked processes (monitoring). */
export function allProcesses(): RunProcess[] {
  return Array.from(_byPid.values());
}

/** Snapshot stats. */
export function stats(): { totalPids: number; activeRuns: number; byStatus: Record<RunProcessStatus, number> } {
  const entries = Array.from(_byPid.values());
  return {
    totalPids:  entries.length,
    activeRuns: _byRun.size,
    byStatus: {
      running: entries.filter(e => e.status === "running").length,
      stopped: entries.filter(e => e.status === "stopped").length,
      crashed: entries.filter(e => e.status === "crashed").length,
    },
  };
}
