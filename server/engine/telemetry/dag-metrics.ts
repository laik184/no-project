/**
 * dag-metrics.ts
 *
 * In-process DAG execution metrics aggregator.
 * Collects timing, throughput, retry, and critical-path data per run.
 *
 * FIXED: Added handler for dag.node.skipped event (previously untracked).
 * Single responsibility: metrics collection. No execution logic.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DagRunMetrics {
  runId:          string;
  projectId:      number;
  graphId:        string;
  startedAt:      number;
  completedAt?:   number;
  totalMs?:       number;
  totalNodes:     number;
  completedNodes: number;
  failedNodes:    number;
  skippedNodes:   number;
  totalRetries:   number;
  rollbacks:      number;
  parallelWaves:  number;
  maxParallelism: number;    // peak simultaneous nodes in one wave
  nodeDurations:  Record<string, number>;  // nodeId → durationMs
  bottleneckNode?:string;    // longest-running node
  outcome:        "running" | "complete" | "failed" | "aborted";
}

// ── In-memory store ───────────────────────────────────────────────────────────

const _metrics = new Map<string, DagRunMetrics>();  // runId → metrics
const MAX_STORED = 50;

function getOrCreate(runId: string, projectId: number, graphId: string): DagRunMetrics {
  if (_metrics.has(runId)) return _metrics.get(runId)!;
  const m: DagRunMetrics = {
    runId, projectId, graphId,
    startedAt:      Date.now(),
    totalNodes:     0,
    completedNodes: 0,
    failedNodes:    0,
    skippedNodes:   0,
    totalRetries:   0,
    rollbacks:      0,
    parallelWaves:  0,
    maxParallelism: 0,
    nodeDurations:  {},
    outcome:        "running",
  };
  _metrics.set(runId, m);
  if (_metrics.size > MAX_STORED) {
    const oldestKey = _metrics.keys().next().value;
    if (oldestKey) _metrics.delete(oldestKey);
  }
  return m;
}

// ── Collectors ────────────────────────────────────────────────────────────────

export function recordNodeCreated(runId: string, projectId: number, graphId: string): void {
  getOrCreate(runId, projectId, graphId).totalNodes++;
}

export function recordNodeCompleted(runId: string, projectId: number, graphId: string, nodeId: string, durationMs: number): void {
  const m = getOrCreate(runId, projectId, graphId);
  m.completedNodes++;
  m.nodeDurations[nodeId] = durationMs;
  if (!m.bottleneckNode || durationMs > (m.nodeDurations[m.bottleneckNode] ?? 0)) {
    m.bottleneckNode = nodeId;
  }
}

export function recordNodeFailed(runId: string, projectId: number, graphId: string): void {
  getOrCreate(runId, projectId, graphId).failedNodes++;
}

// FIXED: previously had no skipped handler — dag.node.skipped was emitted but never counted
export function recordNodeSkipped(runId: string, projectId: number, graphId: string): void {
  getOrCreate(runId, projectId, graphId).skippedNodes++;
}

export function recordRetry(runId: string, projectId: number, graphId: string): void {
  getOrCreate(runId, projectId, graphId).totalRetries++;
}

export function recordRollback(runId: string, projectId: number, graphId: string): void {
  getOrCreate(runId, projectId, graphId).rollbacks++;
}

export function recordWave(runId: string, projectId: number, graphId: string, nodesInWave: number): void {
  const m = getOrCreate(runId, projectId, graphId);
  m.parallelWaves++;
  if (nodesInWave > m.maxParallelism) m.maxParallelism = nodesInWave;
}

export function recordRunComplete(runId: string, projectId: number, graphId: string, outcome: DagRunMetrics["outcome"]): void {
  const m = getOrCreate(runId, projectId, graphId);
  m.outcome     = outcome;
  m.completedAt = Date.now();
  m.totalMs     = m.completedAt - m.startedAt;
  bus.emit("agent.event" as any, {
    runId, projectId, phase: "dag.metrics", agentName: "dag-metrics",
    eventType: "dag.metrics.completed",
    payload: { ...m },
    ts: Date.now(),
  });
  console.log(`[dag-metrics] run=${runId.slice(0,8)} nodes=${m.completedNodes}/${m.totalNodes} skipped=${m.skippedNodes} retries=${m.totalRetries} waves=${m.parallelWaves} ms=${m.totalMs}`);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getRunMetrics(runId: string): DagRunMetrics | undefined {
  return _metrics.get(runId);
}

export function getAllMetrics(): DagRunMetrics[] {
  return [..._metrics.values()];
}

export function evictRunMetrics(runId: string): void {
  _metrics.delete(runId);
}

/** Wire bus events to auto-collect metrics. */
export function initDagMetricsCollector(): void {
  bus.on("agent.event" as any, (e: any) => {
    if (e?.phase !== "dag" || !e.runId) return;
    const { runId, projectId, payload } = e;
    const gId = payload?.graphId ?? runId;
    switch (e.eventType) {
      case "dag.node.created":    recordNodeCreated(runId, projectId, gId); break;
      case "dag.node.completed":  recordNodeCompleted(runId, projectId, gId, payload?.nodeId, payload?.durationMs ?? 0); break;
      case "dag.node.failed":     recordNodeFailed(runId, projectId, gId); break;
      // FIXED: dag.node.skipped is now properly handled
      case "dag.node.skipped":    recordNodeSkipped(runId, projectId, gId); break;
      case "dag.retry":           recordRetry(runId, projectId, gId); break;
      case "dag.rollback":        recordRollback(runId, projectId, gId); break;
      case "dag.parallel.start":  recordWave(runId, projectId, gId, payload?.nodeCount ?? 1); break;
      case "dag.execution.completed":
        recordRunComplete(runId, projectId, gId, payload?.failed > 0 ? "failed" : "complete");
        break;
    }
  });
  console.log("[dag-metrics] Bus collector initialized.");
}
