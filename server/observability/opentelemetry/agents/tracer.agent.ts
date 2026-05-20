import { transitionState } from "../state.js";
import type { Trace, TelemetryState, TraceStatus } from "../types.js";
import { generateTraceId, generateSpanId } from "../utils/trace-id.util.js";
import { nowMs } from "../utils/time.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "tracer";

export interface StartTraceInput {
  readonly service: string;
  readonly rootSpanName: string;
}

export interface StartTraceResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly trace: Readonly<Trace>;
}

export interface EndTraceInput {
  readonly traceId: string;
  readonly status?: TraceStatus;
}

export interface EndTraceResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly trace: Readonly<Trace>;
}

export function startTrace(
  state: Readonly<TelemetryState>,
  input: StartTraceInput,
): Readonly<StartTraceResult> {
  const traceId = generateTraceId();
  const rootSpanId = generateSpanId();

  const trace: Readonly<Trace> = Object.freeze({
    traceId,
    rootSpanId,
    spans: Object.freeze([]),
    startTimeMs: nowMs(),
    status: "RUNNING",
    service: input.service,
  });

  const log = buildLog(
    SOURCE,
    `Trace started: traceId=${traceId} service=${input.service} rootSpan=${input.rootSpanName}`,
  );

  return {
    nextState: transitionState(state, {
      activeTraces: Object.freeze([...state.activeTraces, trace]),
      status: "RUNNING",
      appendLog: log,
    }),
    trace,
  };
}

export function endTrace(
  state: Readonly<TelemetryState>,
  input: EndTraceInput,
): Readonly<EndTraceResult> {
  const existing = state.activeTraces.find((t) => t.traceId === input.traceId);

  if (!existing) {
    const fallback: Readonly<Trace> = Object.freeze({
      traceId: input.traceId,
      rootSpanId: "",
      spans: Object.freeze([]),
      startTimeMs: nowMs(),
      endTimeMs: nowMs(),
      status: "FAILED",
      service: "unknown",
    });

    const log = buildLog(SOURCE, `Trace not found: traceId=${input.traceId}`);
    return {
      nextState: transitionState(state, { appendLog: log }),
      trace: fallback,
    };
  }

  const endTimeMs = nowMs();
  const status: TraceStatus = input.status ?? "COMPLETED";

  const updatedTrace: Readonly<Trace> = Object.freeze({
    ...existing,
    endTimeMs,
    status,
    spans: Object.freeze([...state.spans.filter((s) => s.traceId === input.traceId)]),
  });

  const remaining = state.activeTraces.filter((t) => t.traceId !== input.traceId);
  const log = buildLog(
    SOURCE,
    `Trace ended: traceId=${input.traceId} status=${status} duration=${endTimeMs - existing.startTimeMs}ms`,
  );

  return {
    nextState: transitionState(state, {
      activeTraces: Object.freeze(remaining),
      status,
      appendLog: log,
    }),
    trace: updatedTrace,
  };
}
