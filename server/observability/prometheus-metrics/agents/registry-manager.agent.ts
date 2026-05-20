import { transitionState, upsertMetricToState } from "../state.js";
import type { Metric, MetricConfig, PrometheusState, RegistryConfig } from "../types.js";
import { buildMetric } from "../utils/metric-builder.util.js";
import { renderAllMetrics } from "../utils/renderer.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "registry-manager";

export interface InitRegistryResult {
  readonly nextState: Readonly<PrometheusState>;
  readonly registry: Readonly<Record<string, Metric>>;
}

export interface RegisterMetricResult {
  readonly nextState: Readonly<PrometheusState>;
  readonly metric: Readonly<Metric>;
}

export interface RenderResult {
  readonly nextState: Readonly<PrometheusState>;
  readonly exposition: string;
  readonly metricsCount: number;
}

export function initRegistry(
  state: Readonly<PrometheusState>,
  config: Readonly<RegistryConfig> = {},
): Readonly<InitRegistryResult> {
  const registry = Object.freeze({} as Record<string, Metric>);
  const log = buildLog(
    SOURCE,
    `Registry initialized: prefix=${config.prefix ?? "none"} defaultLabels=${JSON.stringify(config.defaultLabels ?? {})}`,
  );

  return {
    nextState: transitionState(state, {
      registry,
      status: "RUNNING",
      appendLog: log,
    }),
    registry,
  };
}

export function registerMetric(
  state: Readonly<PrometheusState>,
  config: MetricConfig,
): Readonly<RegisterMetricResult> {
  const existing = state.registry?.[config.name];

  if (existing) {
    const log = buildLog(SOURCE, `Metric already registered: ${config.name}`);
    return {
      nextState: transitionState(state, { appendLog: log }),
      metric: existing,
    };
  }

  const metric = buildMetric(config);
  const log = buildLog(SOURCE, `Metric registered: ${config.name} type=${config.type}`);

  return {
    nextState: transitionState(upsertMetricToState(state, metric), { appendLog: log }),
    metric,
  };
}

export function renderExpositon(
  state: Readonly<PrometheusState>,
): Readonly<RenderResult> {
  const exposition = renderAllMetrics(state.metrics);
  const metricsCount = state.metrics.length;
  const log = buildLog(SOURCE, `Exposition rendered: ${metricsCount} metrics`);

  return {
    nextState: transitionState(state, { status: "READY", appendLog: log }),
    exposition,
    metricsCount,
  };
}

export function removeMetric(
  state: Readonly<PrometheusState>,
  name: string,
): Readonly<PrometheusState> {
  if (!state.registry?.[name]) return state;

  const { [name]: _, ...rest } = state.registry;
  const updatedMetrics = state.metrics.filter((m) => m.name !== name);
  const log = buildLog(SOURCE, `Metric removed: ${name}`);

  return transitionState(state, {
    registry: Object.freeze(rest),
    metrics: Object.freeze(updatedMetrics),
    appendLog: log,
  });
}
