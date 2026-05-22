/**
 * server/agents/runtime/types.ts
 * Type contracts for the RuntimeAgent.
 * Single responsibility: typed interfaces only — no logic.
 */

export type RuntimeHealthStatus = "healthy" | "degraded" | "crashed" | "unknown";

export type RuntimeObservationTrigger =
  | "scheduled"
  | "crash_detected"
  | "port_change"
  | "log_spike"
  | "manual";

export interface RuntimeObservationRequest {
  projectId:  number;
  runId:      string;
  trigger:    RuntimeObservationTrigger;
  includeLog?: boolean;
  includePorts?: boolean;
}

export interface PortStatus {
  port:      number;
  open:      boolean;
  latencyMs: number;
  protocol:  "http" | "https" | "tcp";
}

export interface ProcessMetrics {
  pid?:       number;
  uptime:     number;
  cpuPercent: number;
  memoryMb:   number;
  restarts:   number;
}

export interface RuntimeObservationResult {
  projectId:    number;
  runId:        string;
  status:       RuntimeHealthStatus;
  ports:        PortStatus[];
  metrics:      ProcessMetrics;
  recentErrors: string[];
  startupDetected: boolean;
  llmSummary:   string;
  ts:           number;
  durationMs:   number;
}

export interface RuntimeAgentTelemetry {
  runId:      string;
  projectId:  number;
  agentName:  "runtime-agent";
  eventType:
    | "agent.started"
    | "agent.completed"
    | "agent.failed"
    | "agent.retry"
    | "agent.blocked"
    | "agent.recovered"
    | "agent.parallel.started"
    | "agent.parallel.completed";
  payload:    Record<string, unknown>;
  ts:         number;
}
