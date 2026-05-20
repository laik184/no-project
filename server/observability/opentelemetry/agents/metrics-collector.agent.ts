import { transitionState } from "../state.js";
import type { Metric, Span, TelemetryState } from "../types.js";
import { buildMetric, errorRate } from "../utils/metric.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "metrics-collector";

export interface CollectMetricsInput {
  readonly traceId: string;
  readonly spans: readonly Readonly<Span>[];
  readonly service: string;
  readonly totalRequests?: number;
  readonly errorCount?: number;
  readonly extraLabels?: Record<string, string>;
}

export interface CollectMetricsResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly metrics: readonly Readonly<Metric>[];
}

export function collectMetrics(
  state: Readonly<TelemetryState>,
  input: CollectMetricsInput,
): Readonly<CollectMetricsResult> {
  const completedSpans = input.spans.filter((s) => s.durationMs !== undefined);
  const errorSpans = input.spans.filter((s) => s.status === "ERROR");

  const labels: Record<string, string> = {
    traceId: input.traceId,
    service: input.service,
    ...(input.extraLabels ?? {}),
  };

  const collected: Metric[] = [];

  const totalDuration = completedSpans.reduce(
    (acc, s) => acc + (s.durationMs ?? 0),
    0,
  );
  const avgLatency =
    completedSpans.length > 0 ? totalDuration / completedSpans.length : 0;

  collected.push(
    buildMetric("trace.latency.avg_ms", "gauge", avgLatency, "ms", labels),
  );

  collected.push(
    buildMetric(
      "trace.latency.total_ms",
      "counter",
      totalDuration,
      "ms",
      labels,
    ),
  );

  collected.push(
    buildMetric(
      "trace.span.count",
      "counter",
      input.spans.length,
      "spans",
      labels,
    ),
  );

  collected.push(
    buildMetric(
      "trace.span.error_count",
      "counter",
      errorSpans.length,
      "spans",
      labels,
    ),
  );

  if (input.totalRequests !== undefined && input.errorCount !== undefined) {
    const rate = errorRate(input.totalRequests, input.errorCount);
    collected.push(
      buildMetric("trace.error_rate.percent", "gauge", rate, "%", labels),
    );

    collected.push(
      buildMetric(
        "trace.request.count",
        "counter",
        input.totalRequests,
        "requests",
        labels,
      ),
    );
  }

  const frozen = Object.freeze(collected.map((m) => Object.freeze(m)));
  const log = buildLog(
    SOURCE,
    `Metrics collected: ${frozen.length} metrics for traceId=${input.traceId} avgLatency=${avgLatency.toFixed(2)}ms errors=${errorSpans.length}`,
  );

  return {
    nextState: transitionState(state, {
      metrics: Object.freeze([...state.metrics, ...frozen]),
      appendLog: log,
    }),
    metrics: frozen,
  };
}
