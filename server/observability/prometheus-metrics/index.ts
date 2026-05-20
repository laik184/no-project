import {
  initMetricsOrchestrator,
  scrapeMetricsOrchestrator,
  recordHttpRequest,
  incrementCustomCounter,
  setCustomGauge,
  observeCustomHistogram,
  defineCustomMetric,
  registerMetric as registerMetricFromOrchestrator,
} from "./orchestrator.js";
import { INITIAL_STATE } from "./state.js";
import type {
  AgentResult,
  Metric,
  MetricConfig,
  PrometheusState,
  RegistryConfig,
} from "./types.js";

let _state: Readonly<PrometheusState> = INITIAL_STATE;
let _initialized = false;

export async function initMetrics(
  config: Readonly<RegistryConfig> = {},
): Promise<Readonly<AgentResult>> {
  const result = await initMetricsOrchestrator(config, _state);
  _state = result.nextState;
  _initialized = true;
  return result;
}

export async function getMetrics(): Promise<string> {
  if (!_initialized) await initMetrics();
  const result = await scrapeMetricsOrchestrator(_state);
  _state = result.nextState;
  return result.exposition;
}

export function registerMetric(config: MetricConfig): void {
  const result = registerMetricFromOrchestrator(_state, config);
  _state = result.nextState;
}

export function recordRequest(input: {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  responseSizeBytes?: number;
}): void {
  const result = recordHttpRequest(_state, input);
  _state = result.nextState;
}

export function incrementCounter(
  name: string,
  labels?: Record<string, string>,
  by = 1,
  help?: string,
): void {
  const result = incrementCustomCounter(_state, { name, labels, by, help });
  _state = result.nextState;
}

export function setGauge(
  name: string,
  value: number,
  labels?: Record<string, string>,
  help?: string,
): void {
  const result = setCustomGauge(_state, { name, value, labels, help });
  _state = result.nextState;
}

export function observeHistogram(
  name: string,
  value: number,
  labels?: Record<string, string>,
  help?: string,
  buckets?: readonly number[],
): void {
  const result = observeCustomHistogram(_state, { name, value, labels, help, buckets });
  _state = result.nextState;
}

export function defineMetric(config: MetricConfig): void {
  const result = defineCustomMetric(_state, config);
  _state = result.nextState;
}

export function getState(): Readonly<PrometheusState> {
  return _state;
}

export function resetState(): void {
  _state = INITIAL_STATE;
  _initialized = false;
}

export { INITIAL_STATE, transitionState } from "./state.js";

export {
  initMetricsOrchestrator,
  scrapeMetricsOrchestrator,
  recordHttpRequest,
  incrementCustomCounter,
  setCustomGauge,
  observeCustomHistogram,
  defineCustomMetric,
} from "./orchestrator.js";

export type {
  AgentResult,
  HistogramBucket,
  HistogramData,
  Metric,
  MetricConfig,
  MetricResult,
  MetricSample,
  MetricStatus,
  MetricType,
  PrometheusOutput,
  PrometheusState,
  RegistryConfig,
  StatePatch,
} from "./types.js";
