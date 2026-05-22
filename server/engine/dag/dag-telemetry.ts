/**
 * dag-telemetry.ts
 *
 * Bridges DAG execution lifecycle into the event bus.
 * Emits ALL 10 mandatory dag.* events for full SSE observability.
 *
 * Single responsibility: bus event emission only.
 * No execution logic, no state mutation.
 */

import { bus } from "../../infrastructure/events/bus.ts";
import type { SchedulerEvents, SchedulerWave } from "../graph/node-scheduler.ts";
import type { ExecutionNode } from "../graph/graph-types.ts";

export interface DagTelemetryContext {
  runId:     string;
  projectId: number;
  graphId:   string;
}

// ── Per-node event emitters ───────────────────────────────────────────────────

export function emitNodeCreated(ctx: DagTelemetryContext, node: ExecutionNode): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.node.created",
    payload:   { nodeId: node.id, label: node.label, type: node.type, dependsOn: node.dependsOn },
    ts:        Date.now(),
  });
}

export function emitNodeReady(ctx: DagTelemetryContext, node: ExecutionNode): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.node.ready",
    payload:   { nodeId: node.id, label: node.label },
    ts:        Date.now(),
  });
}

export function emitNodeStarted(ctx: DagTelemetryContext, node: ExecutionNode): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.node.started",
    payload:   { nodeId: node.id, label: node.label, type: node.type },
    ts:        Date.now(),
  });
}

export function emitNodeCompleted(ctx: DagTelemetryContext, node: ExecutionNode, durationMs: number): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.node.completed",
    payload:   { nodeId: node.id, label: node.label, durationMs, result: node.result },
    ts:        Date.now(),
  });
}

export function emitNodeFailed(ctx: DagTelemetryContext, node: ExecutionNode, error: string): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.node.failed",
    payload:   { nodeId: node.id, label: node.label, error, retryCount: node.retryCount },
    ts:        Date.now(),
  });
}

export function emitNodeRetry(ctx: DagTelemetryContext, node: ExecutionNode, attempt: number): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.retry",
    payload:   { nodeId: node.id, label: node.label, attempt, maxRetries: node.maxRetries },
    ts:        Date.now(),
  });
}

export function emitNodeRollback(ctx: DagTelemetryContext, nodeId: string, reason: string): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.rollback",
    payload:   { nodeId, reason },
    ts:        Date.now(),
  });
}

// ── Wave-level events ─────────────────────────────────────────────────────────

export function emitParallelStart(ctx: DagTelemetryContext, wave: SchedulerWave): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.parallel.start",
    payload:   { waveIndex: wave.waveIndex, nodeCount: wave.nodes.length, labels: wave.nodes.map(n => n.label) },
    ts:        Date.now(),
  });
}

export function emitParallelComplete(ctx: DagTelemetryContext, waveIndex: number, passed: number, failed: number): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.parallel.complete",
    payload:   { waveIndex, passed, failed },
    ts:        Date.now(),
  });
}

// ── Graph-level event ─────────────────────────────────────────────────────────

export function emitExecutionCompleted(ctx: DagTelemetryContext, totalMs: number, completed: number, failed: number): void {
  bus.emit("agent.event" as any, {
    runId:     ctx.runId,
    projectId: ctx.projectId,
    phase:     "dag",
    agentName: "dag-engine",
    eventType: "dag.execution.completed",
    payload:   { graphId: ctx.graphId, totalMs, completed, failed },
    ts:        Date.now(),
  });
}

// ── SchedulerEvents bridge ────────────────────────────────────────────────────

/**
 * Returns a SchedulerEvents object wired to bus emissions.
 * Pass to runGraph({ events: createDagBusEvents(ctx) }).
 */
export function createDagBusEvents(ctx: DagTelemetryContext): Partial<SchedulerEvents> {
  return {
    onWaveStart: (wave, _waveIndex) => emitParallelStart(ctx, wave),
    onWaveEnd:   (waveIndex, passed, failed) => emitParallelComplete(ctx, waveIndex, passed, failed),
    onGraphFailed: (failedNodeId, reason) => {
      bus.emit("agent.event" as any, {
        runId: ctx.runId, projectId: ctx.projectId, phase: "dag",
        agentName: "dag-engine", eventType: "dag.node.failed",
        payload: { nodeId: failedNodeId, error: reason }, ts: Date.now(),
      });
    },
    onGraphDone: (totalWaves) => {
      bus.emit("agent.event" as any, {
        runId: ctx.runId, projectId: ctx.projectId, phase: "dag",
        agentName: "dag-engine", eventType: "dag.execution.completed",
        payload: { graphId: ctx.graphId, totalWaves }, ts: Date.now(),
      });
    },
  };
}
