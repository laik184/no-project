import { transitionState, upsertMetricToState, lookupMetricInState } from "../state.js";
import type { HistogramData, Metric, MetricConfig, PrometheusState } from "../types.js";
import { buildMetric, updateMetricSamples, getDefaultBuckets } from "../utils/metric-builder.util.js";
import { incrementCounter, setGauge } from "../utils/counter.util.js";
import { buildEmptyHistogram, recordObservation } from "../utils/histogram.util.js";
import { normalizeLabels } from "../utils/label-normalizer.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "custom-metrics";

export interface IncrementCounterInput {
  readonly name: string;
  readonly labels?: Record<string, string>;
  readonly by?: number;
  readonly help?: string;
}

export interface SetGaugeInput {
  readonly name: string;
  readonly value: number;
  readonly labels?: Record<string, string>;
  readonly help?: string;
}

export interface ObserveHistogramInput {
  readonly name: string;
  readonly value: number;
  readonly labels?: Record<string, string>;
  readonly help?: string;
  readonly buckets?: readonly number[];
}

export interface CustomMetricResult {
  readonly nextState: Readonly<PrometheusState>;
  readonly metric: Readonly<Metric>;
}

export function incrementCustomCounter(
  state: Readonly<PrometheusState>,
  input: IncrementCounterInput,
): Readonly<CustomMetricResult> {
  const labels = normalizeLabels(input.labels ?? {});

  const existing =
    lookupMetricInState(state, input.name) ??
    buildMetric({ name: input.name, type: "counter", help: input.help ?? `Custom counter: ${input.name}` });

  const updated = updateMetricSamples(
    existing,
    incrementCounter(existing.samples, labels, input.by ?? 1),
  );

  const log = buildLog(SOURCE, `Counter incremented: ${input.name} by=${input.by ?? 1}`);
  return {
    nextState: transitionState(upsertMetricToState(state, updated), { appendLog: log }),
    metric: updated,
  };
}

export function setCustomGauge(
  state: Readonly<PrometheusState>,
  input: SetGaugeInput,
): Readonly<CustomMetricResult> {
  const labels = normalizeLabels(input.labels ?? {});

  const existing =
    lookupMetricInState(state, input.name) ??
    buildMetric({ name: input.name, type: "gauge", help: input.help ?? `Custom gauge: ${input.name}` });

  const updated = updateMetricSamples(
    existing,
    setGauge(existing.samples, labels, input.value),
  );

  const log = buildLog(SOURCE, `Gauge set: ${input.name} value=${input.value}`);
  return {
    nextState: transitionState(upsertMetricToState(state, updated), { appendLog: log }),
    metric: updated,
  };
}

export function observeCustomHistogram(
  state: Readonly<PrometheusState>,
  input: ObserveHistogramInput,
): Readonly<CustomMetricResult> {
  const labels = normalizeLabels(input.labels ?? {});
  const buckets = getDefaultBuckets(input.buckets);

  const existing =
    lookupMetricInState(state, input.name) ??
    buildMetric({ name: input.name, type: "histogram", help: input.help ?? `Custom histogram: ${input.name}`, buckets: [...buckets] }, [], []);

  const existingHisto = existing.histograms?.find(
    (h) => JSON.stringify(h.labels) === JSON.stringify(labels),
  );
  const histo = existingHisto ?? buildEmptyHistogram(labels, buckets);
  const updatedHisto = recordObservation(histo, input.value);

  const updatedHistos: readonly HistogramData[] = existing.histograms
    ? existing.histograms.some((h) => JSON.stringify(h.labels) === JSON.stringify(labels))
      ? existing.histograms.map((h) =>
          JSON.stringify(h.labels) === JSON.stringify(labels) ? updatedHisto : h,
        )
      : [...existing.histograms, updatedHisto]
    : [updatedHisto];

  const updated = updateMetricSamples(existing, existing.samples, Object.freeze(updatedHistos));
  const log = buildLog(SOURCE, `Histogram observed: ${input.name} value=${input.value}`);

  return {
    nextState: transitionState(upsertMetricToState(state, updated), { appendLog: log }),
    metric: updated,
  };
}

export function defineCustomMetric(
  state: Readonly<PrometheusState>,
  config: MetricConfig,
): Readonly<CustomMetricResult> {
  const existing = lookupMetricInState(state, config.name);
  if (existing) {
    const log = buildLog(SOURCE, `Metric already defined: ${config.name}`);
    return { nextState: transitionState(state, { appendLog: log }), metric: existing };
  }

  const metric = buildMetric(config, [], []);
  const log = buildLog(SOURCE, `Custom metric defined: ${config.name} type=${config.type}`);

  return {
    nextState: transitionState(upsertMetricToState(state, metric), { appendLog: log }),
    metric,
  };
}
