/**
 * server/agents/contracts/types.ts
 * Typed message contracts for inter-agent communication.
 * Agents communicate ONLY through these typed contracts — no direct calls.
 */

export type AgentRole =
  | "planner"
  | "executor"
  | "debugger"
  | "verifier"
  | "security"
  | "browser"
  | "reflection"
  | "memory";

export type AgentMessageType =
  | "plan.request"
  | "plan.response"
  | "task.assigned"
  | "task.completed"
  | "task.failed"
  | "verify.request"
  | "verify.response"
  | "debug.request"
  | "debug.response"
  | "security.scan.request"
  | "security.scan.response"
  | "browser.validate.request"
  | "browser.validate.response"
  | "reflection.request"
  | "reflection.response"
  | "memory.load.request"
  | "memory.load.response";

export interface AgentMessage<T = unknown> {
  messageId:   string;
  type:        AgentMessageType;
  from:        AgentRole;
  to:          AgentRole;
  runId:       string;
  projectId:   number;
  payload:     T;
  ts:          number;
  correlationId?: string;   // links request ↔ response
}

// ── Payload Types ─────────────────────────────────────────────────────────────

export interface PlanRequest {
  goal:      string;
  maxTasks?: number;
  context?:  string;
}

export interface PlanResponse {
  tasks: Array<{ id: string; description: string; dependsOn: string[] }>;
  summary: string;
}

export interface TaskAssignment {
  taskId:      string;
  description: string;
  tools:       string[];
  timeout:     number;
}

export interface TaskResult {
  taskId:   string;
  success:  boolean;
  output:   string;
  error?:   string;
  steps:    number;
}

export interface DebugRequest {
  error:       string;
  context:     string;
  failedTool?: string;
}

export interface DebugResponse {
  diagnosis:  string;
  strategy:   string;
  actions:    string[];
  confidence: number;
}

export interface SecurityScanRequest {
  code:     string;
  filePath: string;
}

export interface SecurityScanResponse {
  blocked:  boolean;
  severity: "low" | "medium" | "high" | "critical";
  findings: string[];
}
