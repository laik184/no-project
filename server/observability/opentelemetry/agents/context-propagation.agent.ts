import { transitionState } from "../state.js";
import type { TelemetryState, TraceContext } from "../types.js";
import { isValidSpanId, isValidTraceId } from "../utils/trace-id.util.js";
import { buildLog } from "../utils/logger.util.js";

const SOURCE = "context-propagation";

const TRACEPARENT_VERSION = "00";

export interface InjectContextInput {
  readonly context: Readonly<TraceContext>;
  readonly headers?: Record<string, string>;
}

export interface InjectContextResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly headers: Readonly<Record<string, string>>;
  readonly traceparent: string;
}

export interface ExtractContextInput {
  readonly headers: Readonly<Record<string, string>>;
}

export interface ExtractContextResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly context: Readonly<TraceContext> | null;
}

export function buildTraceparent(context: Readonly<TraceContext>): string {
  const flags = context.sampled ? "01" : "00";
  return `${TRACEPARENT_VERSION}-${context.traceId}-${context.spanId}-${flags}`;
}

export function parseTraceparent(
  header: string,
): Pick<TraceContext, "traceId" | "spanId" | "sampled"> | null {
  const parts = header.trim().split("-");
  if (parts.length < 4) return null;

  const [, traceId, spanId, flags] = parts;

  if (!isValidTraceId(traceId) || !isValidSpanId(spanId)) return null;

  return {
    traceId,
    spanId,
    sampled: flags === "01",
  };
}

export function injectContext(
  state: Readonly<TelemetryState>,
  input: InjectContextInput,
): Readonly<InjectContextResult> {
  const traceparent = buildTraceparent(input.context);

  const baggage = input.context.baggage
    ? Object.entries(input.context.baggage)
        .map(([k, v]) => `${k}=${v}`)
        .join(",")
    : undefined;

  const outHeaders: Record<string, string> = {
    ...(input.headers ?? {}),
    traceparent,
    ...(baggage ? { baggage } : {}),
  };

  const log = buildLog(
    SOURCE,
    `Context injected: traceId=${input.context.traceId} spanId=${input.context.spanId} sampled=${input.context.sampled}`,
  );

  return {
    nextState: transitionState(state, { appendLog: log }),
    headers: Object.freeze(outHeaders),
    traceparent,
  };
}

export function extractContext(
  state: Readonly<TelemetryState>,
  input: ExtractContextInput,
): Readonly<ExtractContextResult> {
  const rawTraceparent =
    input.headers["traceparent"] ?? input.headers["Traceparent"];

  if (!rawTraceparent) {
    const log = buildLog(SOURCE, "No traceparent header found — starting new context");
    return {
      nextState: transitionState(state, { appendLog: log }),
      context: null,
    };
  }

  const parsed = parseTraceparent(rawTraceparent);
  if (!parsed) {
    const log = buildLog(SOURCE, `Invalid traceparent header: ${rawTraceparent}`);
    return {
      nextState: transitionState(state, { appendLog: log }),
      context: null,
    };
  }

  const rawBaggage = input.headers["baggage"] ?? input.headers["Baggage"];
  const baggage: Record<string, string> = {};
  if (rawBaggage) {
    for (const pair of rawBaggage.split(",")) {
      const [k, v] = pair.split("=");
      if (k && v) baggage[k.trim()] = v.trim();
    }
  }

  const context: Readonly<TraceContext> = Object.freeze({
    traceId: parsed.traceId,
    spanId: parsed.spanId,
    sampled: parsed.sampled,
    ...(Object.keys(baggage).length > 0 ? { baggage: Object.freeze(baggage) } : {}),
  });

  const log = buildLog(
    SOURCE,
    `Context extracted: traceId=${context.traceId} spanId=${context.spanId} sampled=${context.sampled}`,
  );

  return {
    nextState: transitionState(state, { appendLog: log }),
    context,
  };
}
