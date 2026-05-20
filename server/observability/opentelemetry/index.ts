import {
  runTraceSessionOrchestrator,
  startTrace,
  endTrace,
  collectMetrics,
} from "./orchestrator.js";
import { INITIAL_STATE, transitionState } from "./state.js";
import type {
  AgentResult,
  ExporterConfig,
  Metric,
  TelemetryState,
} from "./types.js";

let _state: Readonly<TelemetryState> = INITIAL_STATE;

export async function startTraceSession(
  service: string,
  rootSpanName: string,
  options?: {
    readonly attributes?: Record<string, unknown>;
    readonly incomingHeaders?: Record<string, string>;
    readonly exporterConfig?: Readonly<ExporterConfig>;
  },
): Promise<Readonly<AgentResult>> {
  const result = await runTraceSessionOrchestrator(
    {
      service,
      rootSpanName,
      attributes: options?.attributes,
      incomingHeaders: options?.incomingHeaders,
      exporterConfig: options?.exporterConfig,
    },
    _state,
  );
  _state = result.nextState;
  return result;
}

export function startTraceOnly(
  service: string,
  rootSpanName: string,
): Readonly<ReturnType<typeof startTrace>> {
  const result = startTrace(_state, { service, rootSpanName });
  _state = result.nextState;
  return result;
}

export function endTraceOnly(
  traceId: string,
): Readonly<ReturnType<typeof endTrace>> {
  const result = endTrace(_state, { traceId });
  _state = result.nextState;
  return result;
}

export function getMetrics(): readonly Readonly<Metric>[] {
  return _state.metrics;
}

export function getState(): Readonly<TelemetryState> {
  return _state;
}

export function resetState(): void {
  _state = INITIAL_STATE;
}

export { INITIAL_STATE, transitionState } from "./state.js";

export {
  runTraceSessionOrchestrator,
  startTrace,
  endTrace,
  createSpan,
  closeSpan,
  collectMetrics,
  trackError,
  injectContext,
  extractContext,
  exportTelemetry,
} from "./orchestrator.js";

export type {
  AgentResult,
  ExporterConfig,
  ExporterTarget,
  ExportPayload,
  Metric,
  MetricKind,
  Span,
  SpanEvent,
  SpanStatus,
  StatePatch,
  TelemetryResult,
  TelemetryState,
  Trace,
  TraceContext,
  TraceStatus,
} from "./types.js";
