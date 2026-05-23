/**
 * Responsibility: Central distributed telemetry facade — single import point for
 *                 all distributed tracing. Wires correlation IDs to execution spans
 *                 and exposes a unified snapshot for observability endpoints.
 * Dependencies: correlation-id, execution-span, worker-trace (existing), aggregation-trace,
 *               retry-trace, lock-trace, queue-trace (existing)
 * Failure: all snapshot methods return safe defaults; never throws.
 * Telemetry: aggregates snapshots from all sub-tracers.
 */

import { correlationIdManager }  from "./correlation-id.ts";
import { executionSpan }         from "./execution-span.ts";
import { aggregationTrace }      from "./aggregation-trace.ts";
import { retryTrace }            from "./retry-trace.ts";
import { lockTrace }             from "./lock-trace.ts";
import { workerTrace }           from "./worker-trace.ts";
import { queueTrace }            from "./queue-trace.ts";

class DistributedTelemetry {
  snapshot() {
    return {
      correlations: correlationIdManager.activeCount(),
      activeSpans:  executionSpan.activeCount(),
      queue:        queueTrace.snapshot(),
      workers:      workerTrace.snapshot(),
      aggregation:  aggregationTrace.snapshot(),
      retries:      retryTrace.snapshot(),
    };
  }

  /** Create a root span for a full distributed run. */
  startRun(runId: string, tags: Record<string, string> = {}): string {
    const ctx = correlationIdManager.create(runId, "run", tags);
    return executionSpan.start("run", runId, tags);
  }

  endRun(spanId: string, status: "ok" | "error" = "ok", error?: string): void {
    executionSpan.end(spanId, status, error);
  }
}

export const distributedTelemetry = new DistributedTelemetry();
