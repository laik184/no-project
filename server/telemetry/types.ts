/**
 * server/telemetry/types.ts
 * Shared types for the observability and telemetry system.
 * No logic, no imports from sibling modules.
 */

export type TelemetryEventType =
  | "policy.blocked"
  | "verifier.failed"
  | "browser.failed"
  | "runtime.crashed"
  | "hallucination.detected"
  | "retry.triggered"
  | "sandbox.blocked"
  | "completion.rejected"
  | "completion.passed"
  | "agent.started"
  | "agent.completed"
  | "tool.executed"
  | "tool.blocked"
  | "phase.started"
  | "phase.completed"
  | "phase.failed"
  | "security.violation"
  | "recovery.triggered"
  | "checkpoint.saved";

export type TelemetrySeverity = "info" | "warn" | "error" | "critical";

export interface TelemetryEvent {
  id:          string;
  type:        TelemetryEventType;
  severity:    TelemetrySeverity;
  runId:       string;
  projectId:   number;
  ts:          number;
  phase?:      string;
  agentName?:  string;
  payload:     Record<string, unknown>;
  tags:        string[];
}

export interface TelemetryQuery {
  runId?:      string;
  projectId?:  number;
  types?:      TelemetryEventType[];
  severity?:   TelemetrySeverity;
  fromTs?:     number;
  toTs?:       number;
  limit?:      number;
}

export interface TelemetrySummary {
  totalEvents:      number;
  byType:           Record<string, number>;
  bySeverity:       Record<string, number>;
  policyBlocks:     number;
  verifierFailures: number;
  sandboxBlocks:    number;
  retryCount:       number;
  completionPassed: boolean | null;
}
