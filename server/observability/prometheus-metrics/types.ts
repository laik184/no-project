export type MetricType = "counter" | "gauge" | "histogram" | "summary";

export type MetricStatus = "IDLE" | "RUNNING" | "READY" | "FAILED";

export type MetricLabel = Readonly<Record<string, string>>;

export interface MetricSample {
  readonly labels: MetricLabel;
  readonly value: number;
  readonly timestampMs?: number;
}

export interface HistogramBucket {
  readonly le: number | "+Inf";
  readonly count: number;
}

export interface HistogramData {
  readonly buckets: readonly HistogramBucket[];
  readonly sum: number;
  readonly count: number;
  readonly labels: MetricLabel;
}

export interface Metric {
  readonly name: string;
  readonly type: MetricType;
  readonly help: string;
  readonly samples: readonly MetricSample[];
  readonly histograms?: readonly HistogramData[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface MetricConfig {
  readonly name: string;
  readonly type: MetricType;
  readonly help: string;
  readonly labelNames?: readonly string[];
  readonly buckets?: readonly number[];
}

export interface MetricResult {
  readonly success: boolean;
  readonly name: string;
  readonly type: MetricType;
  readonly samplesCount: number;
}

export interface RegistryConfig {
  readonly prefix?: string;
  readonly defaultLabels?: MetricLabel;
  readonly collectDefaultMetrics?: boolean;
}

export interface PrometheusOutput {
  readonly success: boolean;
  readonly metricsCount: number;
  readonly endpoint: "/metrics";
  readonly exposition: string;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface PrometheusState {
  readonly metrics: readonly Metric[];
  readonly registry: Readonly<Record<string, Metric>> | null;
  readonly status: MetricStatus;
  readonly logs: readonly string[];
  readonly errors: readonly string[];
}

export interface StatePatch {
  readonly metrics?: readonly Metric[];
  readonly registry?: Readonly<Record<string, Metric>> | null;
  readonly status?: MetricStatus;
  readonly appendLog?: string;
  readonly appendError?: string;
}

export interface AgentResult {
  readonly nextState: Readonly<PrometheusState>;
  readonly output: Readonly<PrometheusOutput>;
}
