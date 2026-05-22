/**
 * server/agents/review/types.ts
 * Type contracts for the ReviewAgent.
 * Single responsibility: typed interfaces only — no logic.
 */

export type ReviewSeverity = "info" | "warn" | "error" | "critical";
export type ReviewCategory =
  | "code_quality"
  | "architecture"
  | "security"
  | "performance"
  | "policy"
  | "style";

export interface ReviewFinding {
  category:    ReviewCategory;
  severity:    ReviewSeverity;
  file?:       string;
  line?:       number;
  message:     string;
  suggestion?: string;
}

export interface ReviewRequest {
  projectId:   number;
  runId:       string;
  files:       Array<{ path: string; content: string }>;
  goal?:       string;
  policy?:     string[];
  focusAreas?: ReviewCategory[];
}

export interface ReviewResult {
  projectId:   number;
  runId:       string;
  passed:      boolean;
  score:       number;          // 0–100
  findings:    ReviewFinding[];
  summary:     string;
  blockers:    ReviewFinding[]; // severity = error | critical
  warnings:    ReviewFinding[]; // severity = warn
  durationMs:  number;
  ts:          number;
}

export interface ReviewAgentTelemetry {
  runId:      string;
  projectId:  number;
  agentName:  "review-agent";
  eventType:
    | "agent.started"
    | "agent.completed"
    | "agent.failed"
    | "agent.blocked";
  payload:    Record<string, unknown>;
  ts:         number;
}

export const POLICY_RULES: readonly string[] = Object.freeze([
  "No hardcoded secrets or API keys",
  "No direct database calls from frontend code",
  "All external API calls must originate from the server",
  "No use of eval() or new Function()",
  "Async errors must be caught — no unhandled promise rejections",
  "No file operations outside the sandbox path",
  "Environment variables must not be exposed via VITE_ prefix",
]);
