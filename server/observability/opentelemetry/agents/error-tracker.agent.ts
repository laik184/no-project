import { transitionState } from "../state.js";
import type { Span, SpanEvent, TelemetryState } from "../types.js";
import { nowMs } from "../utils/time.util.js";
import { buildError, buildLog } from "../utils/logger.util.js";

const SOURCE = "error-tracker";

export interface TrackErrorInput {
  readonly error: Error;
  readonly traceId: string;
  readonly spanId: string;
  readonly tags?: Record<string, string>;
}

export interface TrackErrorResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly updatedSpan: Readonly<Span>;
  readonly errorRef: Readonly<{
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
    readonly traceId: string;
    readonly spanId: string;
    readonly tags: Readonly<Record<string, string>>;
    readonly timestampMs: number;
  }>;
}

export function trackError(
  state: Readonly<TelemetryState>,
  input: TrackErrorInput,
): Readonly<TrackErrorResult> {
  const existing = state.spans.find(
    (s) => s.spanId === input.spanId && s.traceId === input.traceId,
  );

  const tags = Object.freeze(input.tags ?? {});

  const errorEvent: Readonly<SpanEvent> = Object.freeze({
    name: "exception",
    timestampMs: nowMs(),
    attributes: Object.freeze({
      "exception.type": input.error.name,
      "exception.message": input.error.message,
      "exception.stacktrace": input.error.stack ?? "",
      ...Object.fromEntries(Object.entries(tags)),
    }),
  });

  const errorRef = Object.freeze({
    name: input.error.name,
    message: input.error.message,
    stack: input.error.stack,
    traceId: input.traceId,
    spanId: input.spanId,
    tags,
    timestampMs: nowMs(),
  });

  let updatedSpan: Readonly<Span>;

  if (existing) {
    updatedSpan = Object.freeze({
      ...existing,
      status: "ERROR",
      events: Object.freeze([...existing.events, errorEvent]),
      error: Object.freeze({
        name: input.error.name,
        message: input.error.message,
        stack: input.error.stack,
      }),
    });

    const updated = state.spans.map((s) =>
      s.spanId === input.spanId ? updatedSpan : s,
    );

    const log = buildLog(
      SOURCE,
      `Error tracked: ${input.error.name} — traceId=${input.traceId} spanId=${input.spanId}`,
    );
    const err = buildError(SOURCE, `${input.error.name}: ${input.error.message}`);

    return {
      nextState: transitionState(state, {
        spans: Object.freeze(updated),
        appendLog: log,
        appendError: err,
      }),
      updatedSpan,
      errorRef,
    };
  }

  updatedSpan = Object.freeze({
    spanId: input.spanId,
    traceId: input.traceId,
    name: "error-only",
    startTimeMs: nowMs(),
    endTimeMs: nowMs(),
    durationMs: 0,
    status: "ERROR",
    attributes: Object.freeze({ ...Object.fromEntries(Object.entries(tags)) }),
    events: Object.freeze([errorEvent]),
    error: Object.freeze({
      name: input.error.name,
      message: input.error.message,
      stack: input.error.stack,
    }),
  });

  const log = buildLog(
    SOURCE,
    `Error tracked (orphan span): ${input.error.name} — traceId=${input.traceId}`,
  );
  const err = buildError(SOURCE, `${input.error.name}: ${input.error.message}`);

  return {
    nextState: transitionState(state, {
      spans: Object.freeze([...state.spans, updatedSpan]),
      appendLog: log,
      appendError: err,
    }),
    updatedSpan,
    errorRef,
  };
}
