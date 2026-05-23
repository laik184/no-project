/**
 * server/telemetry/parallel/index.ts
 *
 * Unified telemetry facade for the Parallel Execution subsystem (Phase 9).
 *
 * Aggregates telemetry from all three parallel execution layers:
 *   1. Tool-loop layer  (tool.parallel.started / completed / failed)
 *   2. DAG/graph layer  (dag.wave.started / completed)
 *   3. Worker pool layer (worker.spawned / completed / failed / timeout)
 *
 * All events carry correlation IDs, wave trace IDs, and execution trace IDs
 * for distributed tracing readiness.
 */

import { bus }  from "../../infrastructure/events/bus.ts";
import { v4 as uuidv4 } from "uuid";

// ── Correlation ID management ─────────────────────────────────────────────────

const _correlationMap = new Map<string, string>(); // runId → correlationId

export function getOrCreateCorrelationId(runId: string): string {
  let id = _correlationMap.get(runId);
  if (!id) {
    id = `corr:${uuidv4()}`;
    _correlationMap.set(runId, id);
  }
  return id;
}

export function releaseCorrelationId(runId: string): void {
  _correlationMap.delete(runId);
}

// ── Parallel batch telemetry ──────────────────────────────────────────────────

export function emitParallelBatchStarted(params: {
  runId:      string;
  batchId:    string;
  toolNames:  string[];
  layer:      "tool-loop" | "dag" | "scanner";
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "tool.parallel.started" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      batchId:       params.batchId,
      toolCount:     params.toolNames.length,
      toolNames:     params.toolNames,
      layer:         params.layer,
      correlationId: getOrCreateCorrelationId(params.runId),
    },
  });
}

export function emitParallelBatchCompleted(params: {
  runId:       string;
  batchId:     string;
  succeeded:   number;
  failed:      number;
  durationMs:  number;
  layer:       "tool-loop" | "dag" | "scanner";
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "tool.parallel.completed" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      batchId:       params.batchId,
      succeeded:     params.succeeded,
      failed:        params.failed,
      durationMs:    params.durationMs,
      layer:         params.layer,
      correlationId: getOrCreateCorrelationId(params.runId),
    },
  });
}

export function emitParallelBatchFailed(params: {
  runId:    string;
  batchId:  string;
  error:    string;
  layer:    "tool-loop" | "dag" | "scanner";
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "tool.parallel.failed" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      batchId:       params.batchId,
      error:         params.error,
      layer:         params.layer,
      correlationId: getOrCreateCorrelationId(params.runId),
    },
  });
}

// ── Aggregation telemetry ─────────────────────────────────────────────────────

export function emitAggregationCompleted(params: {
  runId:           string;
  waveIndex:       number;
  successfulNodes: number;
  mergedFiles:     number;
  confidence:      number;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "aggregation.completed" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      waveIndex:       params.waveIndex,
      successfulNodes: params.successfulNodes,
      mergedFiles:     params.mergedFiles,
      confidence:      params.confidence,
      correlationId:   getOrCreateCorrelationId(params.runId),
    },
  });
}

export function emitConflictDetected(params: {
  runId:       string;
  batchId:     string;
  resourceKey: string;
  ownerIds:    string[];
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "conflict.detected" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      batchId:       params.batchId,
      resourceKey:   params.resourceKey,
      ownerIds:      params.ownerIds,
      correlationId: getOrCreateCorrelationId(params.runId),
    },
  });
}

export function emitConflictResolved(params: {
  runId:       string;
  batchId:     string;
  resourceKey: string;
  resolution:  "serialized" | "aborted" | "retried";
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "conflict.resolved" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      batchId:       params.batchId,
      resourceKey:   params.resourceKey,
      resolution:    params.resolution,
      correlationId: getOrCreateCorrelationId(params.runId),
    },
  });
}

// ── Memory safety telemetry ───────────────────────────────────────────────────

export function emitMemoryLocked(params: {
  runId:    string;
  ownerId:  string;
  filePath: string;
  ttlMs:    number;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "memory.locked" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      ownerId:       params.ownerId,
      filePath:      params.filePath,
      ttlMs:         params.ttlMs,
      correlationId: getOrCreateCorrelationId(params.runId),
    },
  });
}

export function emitMemoryReleased(params: {
  runId:    string;
  ownerId:  string;
  filePath: string;
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "memory.released" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      ownerId:       params.ownerId,
      filePath:      params.filePath,
      correlationId: getOrCreateCorrelationId(params.runId),
    },
  });
}

// ── Queue telemetry ───────────────────────────────────────────────────────────

export function emitQueueBackpressure(params: {
  runId:           string;
  queueDepth:      number;
  maxDepth:        number;
  saturationRatio: number;
  decision:        "throttle" | "reject";
}): void {
  bus.emit("agent.event", {
    runId:     params.runId,
    eventType: "queue.backpressure" as any,
    phase:     "parallel-telemetry",
    ts:        Date.now(),
    payload:   {
      queueDepth:      params.queueDepth,
      maxDepth:        params.maxDepth,
      saturationRatio: params.saturationRatio,
      decision:        params.decision,
      correlationId:   getOrCreateCorrelationId(params.runId),
    },
  });
}
