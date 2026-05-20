import { transitionState, upsertMetricToState, lookupMetricInState } from "../state.js";
import type { HistogramData, Metric, PrometheusState } from "../types.js";
import { buildMetric, updateMetricSamples } from "../utils/metric-builder.util.js";
import { incrementCounter } from "../utils/counter.util.js";
import { buildEmptyHistogram, recordObservation } from "../utils/histogram.util.js";
import { normalizeLabels } from "../utils/label-normalizer.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "http-metrics";

const HTTP_REQUESTS_TOTAL = "http_requests_total";
const HTTP_REQUEST_DURATION_SECONDS = "http_request_duration_seconds";
const HTTP_REQUESTS_IN_FLIGHT = "http_requests_in_flight";
const HTTP_RESPONSE_SIZE_BYTES = "http_response_size_bytes";

const DURATION_BUCKETS: readonly number[] = Object.freeze([
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
]);

const SIZE_BUCKETS: readonly number[] = Object.freeze([
  100, 1_000, 10_000, 100_000, 1_000_000,
]);

export interface RecordHttpRequestInput {
  readonly method: string;
  readonly route: string;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly responseSizeBytes?: number;
}

export interface HttpMetricsResult {
  readonly nextState: Readonly<PrometheusState>;
  readonly recorded: boolean;
}

export interface InFlightResult {
  readonly nextState: Readonly<PrometheusState>;
}

function upsertHistogram(
  metric: Readonly<Metric>,
  histoLabels: ReturnType<typeof normalizeLabels>,
  value: number,
  buckets: readonly number[],
): Readonly<Metric> {
  const existing = metric.histograms?.find(
    (h) => JSON.stringify(h.labels) === JSON.stringify(histoLabels),
  );
  const histo = existing ?? buildEmptyHistogram(histoLabels, buckets);
  const updated = recordObservation(histo, value);

  const updatedHistos: readonly HistogramData[] = metric.histograms
    ? metric.histograms.some((h) => JSON.stringify(h.labels) === JSON.stringify(histoLabels))
      ? metric.histograms.map((h) =>
          JSON.stringify(h.labels) === JSON.stringify(histoLabels) ? updated : h,
        )
      : [...metric.histograms, updated]
    : [updated];

  return updateMetricSamples(metric, metric.samples, Object.freeze(updatedHistos));
}

export function recordHttpRequest(
  state: Readonly<PrometheusState>,
  input: RecordHttpRequestInput,
): Readonly<HttpMetricsResult> {
  let current = state;

  const counterLabels = normalizeLabels({
    method: input.method.toUpperCase(),
    route: input.route,
    status: String(input.statusCode),
    status_class: `${Math.floor(input.statusCode / 100)}xx`,
  });

  const durationLabels = normalizeLabels({
    method: input.method.toUpperCase(),
    route: input.route,
  });

  const counterMetric =
    lookupMetricInState(current, HTTP_REQUESTS_TOTAL) ??
    buildMetric({ name: HTTP_REQUESTS_TOTAL, type: "counter", help: "Total HTTP requests, by method, route, and status" });

  const updatedCounter = updateMetricSamples(
    counterMetric,
    incrementCounter(counterMetric.samples, counterLabels),
  );
  current = upsertMetricToState(current, updatedCounter);

  const histMetric =
    lookupMetricInState(current, HTTP_REQUEST_DURATION_SECONDS) ??
    buildMetric({ name: HTTP_REQUEST_DURATION_SECONDS, type: "histogram", help: "HTTP request duration in seconds" }, [], []);

  current = upsertMetricToState(
    current,
    upsertHistogram(histMetric, durationLabels, input.durationMs / 1_000, DURATION_BUCKETS),
  );

  if (input.responseSizeBytes !== undefined) {
    const sizeLabels = normalizeLabels({ method: input.method.toUpperCase(), route: input.route });
    const sizeMetric =
      lookupMetricInState(current, HTTP_RESPONSE_SIZE_BYTES) ??
      buildMetric({ name: HTTP_RESPONSE_SIZE_BYTES, type: "histogram", help: "HTTP response size in bytes" }, [], []);
    current = upsertMetricToState(
      current,
      upsertHistogram(sizeMetric, sizeLabels, input.responseSizeBytes, SIZE_BUCKETS),
    );
  }

  const log = buildLog(
    SOURCE,
    `HTTP recorded: ${input.method} ${input.route} ${input.statusCode} ${input.durationMs}ms`,
  );

  return {
    nextState: transitionState(current, { appendLog: log }),
    recorded: true,
  };
}

export function incrementInFlight(
  state: Readonly<PrometheusState>,
  delta: 1 | -1,
): Readonly<InFlightResult> {
  const metric =
    lookupMetricInState(state, HTTP_REQUESTS_IN_FLIGHT) ??
    buildMetric({ name: HTTP_REQUESTS_IN_FLIGHT, type: "gauge", help: "Current number of HTTP requests in flight" });

  const current = metric.samples[0]?.value ?? 0;
  const next = Math.max(0, current + delta);
  const updated = updateMetricSamples(metric, [
    Object.freeze({ labels: Object.freeze({}), value: next, timestampMs: Date.now() }),
  ]);

  return { nextState: upsertMetricToState(state, updated) };
}
