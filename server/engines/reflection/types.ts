/**
 * server/engines/reflection/types.ts
 * Shared types for the reflection engine. No logic, no imports from sibling modules.
 */

export type FailureType =
  | "typescript_error"
  | "runtime_crash"
  | "missing_dependency"
  | "missing_file"
  | "preview_unreachable"
  | "tool_misuse"
  | "repeated_strategy"
  | "unknown";

export interface FailureAnalysis {
  failureTypes: FailureType[];
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  details: string[];
}

export interface RetryLoopReport {
  detected: boolean;
  repeatedTool?: string;
  count?: number;
  pattern?: string;
}

export interface RecoveryRecommendation {
  strategy: "fix_imports" | "install_deps" | "restart_runtime" | "change_approach" | "rollback" | "none";
  actions: string[];
  priority: "immediate" | "next_step" | "optional";
}

export interface ReflectionResult {
  projectId: number;
  runId: string;
  failureAnalysis: FailureAnalysis;
  retryLoop: RetryLoopReport;
  recommendation: RecoveryRecommendation;
  elapsedMs: number;
}
