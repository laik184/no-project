/**
 * Responsibility: Aggregation-layer tracing — records multi-path result merging,
 *                 consensus voting, conflict resolution, and AST merge events.
 * Dependencies: execution-span, bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: emits trace.aggregation.event via bus.
 */

import { executionSpan } from "./execution-span.ts";
import { bus }           from "../../infrastructure/events/bus.ts";

interface AggregationMetrics {
  merges:     number;
  conflicts:  number;
  consensus:  number;
  failures:   number;
}

class AggregationTrace {
  private readonly m: AggregationMetrics = { merges: 0, conflicts: 0, consensus: 0, failures: 0 };

  onMergeStarted(runId: string, pathCount: number, strategy: string): string {
    this.m.merges++;
    const spanId = executionSpan.start(`aggregation:merge`, runId, { pathCount: String(pathCount), strategy });
    this.emit("trace.aggregation.event", runId, { event: "merge_started", pathCount, strategy, spanId });
    return spanId;
  }

  onMergeCompleted(spanId: string, runId: string, filesAffected: number): void {
    executionSpan.end(spanId, "ok");
    this.emit("trace.aggregation.event", runId, { event: "merge_completed", filesAffected });
  }

  onConflict(runId: string, filePath: string, strategy: string): void {
    this.m.conflicts++;
    this.emit("trace.aggregation.event", runId, { event: "conflict", filePath, strategy });
  }

  onConsensus(runId: string, outcome: string, confidence: number, voters: number): void {
    this.m.consensus++;
    this.emit("trace.aggregation.event", runId, { event: "consensus", outcome, confidence, voters });
  }

  onAggregationFailed(spanId: string, runId: string, reason: string): void {
    this.m.failures++;
    executionSpan.end(spanId, "error", reason);
    this.emit("trace.aggregation.event", runId, { event: "failed", reason });
  }

  snapshot(): AggregationMetrics { return { ...this.m }; }

  private emit(eventType: string, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.telemetry",
        agentName: "aggregation-trace",
        eventType, payload, ts: Date.now(),
      });
    } catch { /* non-throwing */ }
  }
}

export const aggregationTrace = new AggregationTrace();
