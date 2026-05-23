export interface CorrelationContext {
  correlationId: string;
  traceId:       string;
  spanId:        string;
  parentSpanId?: string;
  runId:         string;
  startedAt:     number;
  tags:          Record<string, string>;
}

export interface ExecutionSpan {
  spanId:       string;
  traceId:      string;
  name:         string;
  runId:        string;
  startedAt:    number;
  endedAt?:     number;
  durationMs?:  number;
  status:       "running" | "ok" | "error";
  error?:       string;
  tags:         Record<string, string>;
  children:     string[];
}

export type SpanStatus = "running" | "ok" | "error";

export type TelemetryEventType =
  | "trace.span.started"
  | "trace.span.ended"
  | "trace.correlation.created"
  | "trace.worker.started"
  | "trace.worker.ended"
  | "trace.queue.event"
  | "trace.lock.event"
  | "trace.aggregation.event"
  | "trace.retry.event";
