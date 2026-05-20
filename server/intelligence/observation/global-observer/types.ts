export type EventStatus = "success" | "fail";

export interface ObservationEvent {
  module: string;
  agent: string;
  status: EventStatus;
  latency: number;
  timestamp: number;
}

export interface ObserverInput {
  events: ObservationEvent[];
}

export interface SignalGroup {
  module: string;
  totalEvents: number;
  successCount: number;
  failCount: number;
  successRate: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
  timeSpanMs: number;
  agents: string[];
}

export interface DetectedPattern {
  type: "repeated-failure" | "latency-spike" | "burst-activity" | "low-throughput" | "high-success-streak";
  module: string;
  agent?: string;
  description: string;
  occurrences: number;
  confidence: number;
}

export interface Anomaly {
  id: string;
  type: "failure-burst" | "latency-spike" | "error-rate-surge" | "dead-agent" | "throughput-drop";
  module: string;
  agent?: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  detectedAt: number;
  metric: string;
  currentValue: number;
  thresholdValue: number;
}

export interface Trend {
  module: string;
  metric: "latency" | "successRate" | "throughput";
  direction: "improving" | "degrading" | "stable";
  slope: number;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
}

export interface Insight {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  module: string;
  title: string;
  description: string;
  recommendedAction: string;
  relatedAnomalies: string[];
}

export interface ObserverData {
  anomalies: Anomaly[];
  trends: Trend[];
  patterns: DetectedPattern[];
  healthScore: number;
  insights: Insight[];
}

export interface ObserverOutput {
  success: boolean;
  logs: string[];
  error?: string;
  data?: ObserverData;
}
