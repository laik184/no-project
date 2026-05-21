/**
 * server/policies/types.ts
 * Shared types for the constraint/policy engine.
 * No logic, no imports from sibling modules.
 */

export type PolicyName =
  | "MaxRetryPolicy"
  | "SafeFilesystemPolicy"
  | "SafeExecutionPolicy"
  | "VerifiedCompletionPolicy"
  | "ToolUsagePolicy"
  | "DependencyTrustPolicy"
  | "RuntimeHealthPolicy"
  | "BrowserValidationPolicy"
  | "FilesystemPolicy"
  | "CompletionPolicy"
  | "RetryPolicy"
  | "DependencyPolicy"
  | "BrowserPolicy"
  | "SandboxPolicy";

export type PolicyDecision = "allow" | "block" | "escalate";
export type PolicySeverity = "low" | "medium" | "high" | "critical";

export interface PolicyContext {
  runId:       string;
  projectId:   number;
  toolName?:   string;
  command?:    string;
  filePath?:   string;
  packageName?: string;
  retryCount?: number;
  metadata?:   Record<string, unknown>;
}

export interface PolicyResult {
  policy:     PolicyName;
  decision:   PolicyDecision;
  severity:   PolicySeverity;
  reason:     string;
  remediation?: string;
}

export interface PolicyReport {
  runId:       string;
  projectId:   number;
  context:     PolicyContext;
  results:     PolicyResult[];
  finalDecision: PolicyDecision;
  blocked:     boolean;
  blockReasons: string[];
  elapsedMs:   number;
}
