import { transitionState } from "../state.js";
import type { Span, SpanEvent, SpanStatus, TelemetryState } from "../types.js";
import { generateSpanId } from "../utils/trace-id.util.js";
import { computeDuration, resolveSpanStatus } from "../utils/span.util.js";
import { nowMs } from "../utils/time.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "span-builder";

export interface CreateSpanInput {
  readonly traceId: string;
  readonly name: string;
  readonly parentSpanId?: string;
  readonly attributes?: Record<string, unknown>;
}

export interface CreateSpanResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly span: Readonly<Span>;
}

export interface CloseSpanInput {
  readonly spanId: string;
  readonly traceId: string;
  readonly httpStatusCode?: number;
  readonly error?: Error;
  readonly events?: SpanEvent[];
}

export interface CloseSpanResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly span: Readonly<Span>;
}

export function createSpan(
  state: Readonly<TelemetryState>,
  input: CreateSpanInput,
): Readonly<CreateSpanResult> {
  const spanId = generateSpanId();

  const span: Readonly<Span> = Object.freeze({
    spanId,
    traceId: input.traceId,
    parentSpanId: input.parentSpanId,
    name: input.name,
    startTimeMs: nowMs(),
    status: "UNSET",
    attributes: Object.freeze({ ...(input.attributes ?? {}) }),
    events: Object.freeze([]),
  });

  const log = buildLog(
    SOURCE,
    `Span created: spanId=${spanId} name=${input.name} traceId=${input.traceId}${input.parentSpanId ? ` parent=${input.parentSpanId}` : ""}`,
  );

  return {
    nextState: transitionState(state, {
      spans: Object.freeze([...state.spans, span]),
      appendLog: log,
    }),
    span,
  };
}

export function closeSpan(
  state: Readonly<TelemetryState>,
  input: CloseSpanInput,
): Readonly<CloseSpanResult> {
  const existing = state.spans.find(
    (s) => s.spanId === input.spanId && s.traceId === input.traceId,
  );

  if (!existing) {
    const ghost: Readonly<Span> = Object.freeze({
      spanId: input.spanId,
      traceId: input.traceId,
      name: "unknown",
      startTimeMs: nowMs(),
      endTimeMs: nowMs(),
      durationMs: 0,
      status: "ERROR",
      attributes: Object.freeze({}),
      events: Object.freeze([]),
    });

    const log = buildLog(SOURCE, `Span not found: spanId=${input.spanId}`);
    return { nextState: transitionState(state, { appendLog: log }), span: ghost };
  }

  const endTimeMs = nowMs();
  const durationMs = computeDuration(existing.startTimeMs, endTimeMs);
  const status: SpanStatus = input.error
    ? "ERROR"
    : resolveSpanStatus(input.httpStatusCode);

  const events: readonly SpanEvent[] = Object.freeze([
    ...existing.events,
    ...(input.events ?? []),
  ]);

  const closed: Readonly<Span> = Object.freeze({
    ...existing,
    endTimeMs,
    durationMs,
    status,
    events,
    ...(input.error
      ? {
          error: Object.freeze({
            name: input.error.name,
            message: input.error.message,
            stack: input.error.stack,
          }),
        }
      : {}),
  });

  const updated = state.spans.map((s) =>
    s.spanId === input.spanId ? closed : s,
  );

  const log = buildLog(
    SOURCE,
    `Span closed: spanId=${input.spanId} duration=${durationMs}ms status=${status}`,
  );

  return {
    nextState: transitionState(state, {
      spans: Object.freeze(updated),
      appendLog: log,
    }),
    span: closed,
  };
}
