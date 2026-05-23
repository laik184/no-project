/**
 * server/telemetry/quantum/index.ts
 *
 * Unified telemetry facade for the Quantum Execution subsystem (Phase 9).
 *
 * Aggregates telemetry from the Quantum runtime layer:
 *   • Path spawning / selection (quantum.path.*)
 *   • Worker pool lifecycle (worker.spawned / assigned / started / completed / failed)
 *   • Memory write queue (memory.write.started / completed / failed)
 *   • File lock manager (lock.acquired / released / expired / collision)
 *
 * All events carry wave trace IDs for distributed tracing.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Task parallelization telemetry ────────────────────────────────────────────

export function emitTaskParallelized(params: {
  runId:     string;
  batchId:   string;
  taskCount: number;
  taskType:  string;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "task.parallelized" as any,
    phase:     "quantum-telemetry",
    ts:        Date.now(),
    payload:   {
      batchId:   params.batchId,
      taskCount: params.taskCount,
      taskType:  params.taskType,
    },
  });
}

// ── Worker pool telemetry (re-exported from worker-telemetry for unified access) ─

export {
  emitWorkerCreated  as emitQuantumWorkerCreated,
  emitWorkerAssigned as emitQuantumWorkerAssigned,
  emitWorkerStarted  as emitQuantumWorkerStarted,
  emitWorkerCompleted as emitQuantumWorkerCompleted,
  emitWorkerFailed   as emitQuantumWorkerFailed,
  emitWorkerTimeout  as emitQuantumWorkerTimeout,
  emitWorkerCancelled as emitQuantumWorkerCancelled,
  emitWorkerOverloaded as emitQuantumWorkerOverloaded,
} from "../quantum/worker-telemetry-proxy.ts";

// ── Pool metrics snapshot ─────────────────────────────────────────────────────

export function emitPoolMetricsSnapshot(params: {
  runId:           string;
  active:          number;
  pending:         number;
  completed:       number;
  failed:          number;
  saturationRatio: number;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "pool.metrics.snapshot" as any,
    phase:     "quantum-telemetry",
    ts:        Date.now(),
    payload:   params,
  });
}

// ── Quantum path telemetry ────────────────────────────────────────────────────

export function emitQuantumPathSpawned(params: {
  runId:    string;
  pathId:   string;
  strategy: string;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "quantum.path.spawned" as any,
    phase:     "quantum-telemetry",
    ts:        Date.now(),
    payload:   params,
  });
}

export function emitQuantumPathSelected(params: {
  runId:      string;
  pathId:     string;
  confidence: number;
  reason:     string;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "quantum.path.selected" as any,
    phase:     "quantum-telemetry",
    ts:        Date.now(),
    payload:   params,
  });
}

export function emitQuantumPathFailed(params: {
  runId:  string;
  pathId: string;
  error:  string;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "quantum.path.failed" as any,
    phase:     "quantum-telemetry",
    ts:        Date.now(),
    payload:   params,
  });
}

// ── Execution lineage ─────────────────────────────────────────────────────────

/**
 * Builds a wave trace ID that links all nodes in a single execution wave.
 * Format: {runId}:wave:{waveIndex}
 */
export function buildWaveTraceId(runId: string, waveIndex: number): string {
  return `${runId}:wave:${waveIndex}`;
}

/**
 * Builds a worker trace ID unique to one task execution attempt.
 * Format: {runId}:worker:{taskId}:{attempt}
 */
export function buildWorkerTraceId(runId: string, taskId: string, attempt: number): string {
  return `${runId}:worker:${taskId}:${attempt}`;
}
