/**
 * server/security/detectors/types.ts
 * Shared types for security detectors.
 * No logic, no imports from sibling modules.
 */

export type SecurityThreat =
  | "secret_leak"
  | "unsafe_eval"
  | "command_injection"
  | "ssrf"
  | "path_traversal"
  | "dangerous_dependency"
  | "env_mutation"
  | "privilege_escalation";

export type ThreatSeverity = "low" | "medium" | "high" | "critical";

export interface SecurityFinding {
  threat:      SecurityThreat;
  severity:    ThreatSeverity;
  evidence:    string;
  location:    string;      // file path or code snippet
  remediation: string;
  blocked:     boolean;     // true = must block execution
}

export interface SecurityReport {
  runId:      string;
  projectId:  number;
  findings:   SecurityFinding[];
  riskScore:  number;        // 0–100
  blocked:    boolean;
  blockReasons: string[];
  elapsedMs:  number;
}
