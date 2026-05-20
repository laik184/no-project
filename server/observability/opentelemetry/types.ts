export type TraceStatus = "IDLE" | "RUNNING" | "COMPLETED" | "FAILED";

export type SpanStatus = "UNSET" | "OK" | "ERROR";

export type MetricKind = "counter" | "gauge" | "histogram";

export type ExporterTarget = "jaeger" | "zipkin" | "prometheus" | "console";

export interface SpanEvent {
  readonly name: string;
  readonly timestampMs: number;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface Span {
  readonly spanId: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly startTimeMs: number;
  readonly endTimeMs?: number;
  readonly durationMs?: number;
  readonly status: SpanStatus;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly events: readonly SpanEvent[];
  readonly error?: Readonly<{
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  }>;
}

export interface Trace {
  readonly traceId: string;
  readonly rootSpanId: string;
  readonly spans: readonly Span[];
  readonly startTimeMs: number;
  readonly endTimeMs?: number;
  readonly status: TraceStatus;
  readonly service: string;
}

export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly sampled: boolean;
  readonly baggage?: Readonly<Record<string, string>>;
}

export interface Metric {
  readonly name: string;
  readonly kind: MetricKind;
  readonly value: number;
  readonly unit: string;
  readonly timestampMs: number;
  readonly labels: Readonly<Record<string, string>>;
}

export interface ExporterConfig {
  readonly target: ExporterTarget;
  readonly endpoint?: string;
  readonly serviceName: string;
  readonly timeout?: number;
}

export interface ExportPayload {
  readonly traceId: string;
  readonly spans: readonly Span[];
  readonly metrics: readonly Metric[];
  readonly service: string;
  readonly exportedAt: string;
}

export interface TelemetryResult {
  readonly success: boolean;
  readonly traceId: string;
  readonly spans: readonly Span[];
  readonly metrics: readonly Metric[];
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface TelemetryState {
  readonly activeTraces: readonly Trace[];
  readonly spans: readonly Span[];
  readonly metrics: readonly Metric[];
  readonly errors: readonly string[];
  readonly status: TraceStatus;
  readonly logs: readonly string[];
}

export interface StatePatch {
  readonly activeTraces?: readonly Trace[];
  readonly spans?: readonly Span[];
  readonly metrics?: readonly Metric[];
  readonly status?: TraceStatus;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<TelemetryState>;
  readonly output: Readonly<TelemetryResult>;
}
