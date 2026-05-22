/**
 * server/engine/reflection/reflection-types.ts
 *
 * Unified types for the Reflection Engine pipeline.
 * Single responsibility: types only — zero imports, zero logic.
 *
 * These types span the full pipeline:
 *   Analyzer → Classifier → RetryGuard → PatchStrategy → Decision → Telemetry
 */

// ── Failure classification ────────────────────────────────────────────────────

export type ReflectionFailureClass =
  | "syntax_error"
  | "typescript_error"
  | "dependency_missing"
  | "runtime_crash"
  | "process_exit"
  | "build_failure"
  | "hydration_failure"
  | "preview_blank"
  | "preview_proxy_failure"
  | "port_conflict"
  | "port_timeout"
  | "infinite_render_loop"
  | "memory_leak"
  | "timeout"
  | "verification_failure"
  | "tool_loop"
  | "unknown";

export type ReflectionSeverity = "low" | "medium" | "high" | "critical";

export type ReflectionTrigger =
  | "crash"
  | "verify_fail"
  | "preview_fail"
  | "tool_loop"
  | "observation";

// ── Classification result ─────────────────────────────────────────────────────

export interface ReflectionClassification {
  primary:     ReflectionFailureClass;
  secondary:   ReflectionFailureClass[];
  severity:    ReflectionSeverity;
  confidence:  number;                  // 0.0 – 1.0
  evidence:    string[];               // log lines / messages that led to classification
  retryable:   boolean;
  recoverable: boolean;
}

// ── Analysis context ──────────────────────────────────────────────────────────

export interface ReflectionContext {
  projectId:    number;
  runId:        string;
  trigger:      ReflectionTrigger;
  timestamp:    number;
  logTail:      string[];             // last 50 lines of runtime logs
  verifyErrors: string[];             // from VerificationReport.issues
  previewDown:  boolean;
  runtimeStatus: string;             // "running" | "crashed" | "stopped" | "unknown"
  port?:        number;
  recentTools:  string[];            // last 5 tool calls for loop detection
  details:      Record<string, unknown>;
}

// ── Patch plan ────────────────────────────────────────────────────────────────

export type PatchAction =
  | { type: "install_deps";   packages: string[] }
  | { type: "restart_server"; reason: string }
  | { type: "rollback";       reason: string }
  | { type: "fix_typescript"; hint: string }
  | { type: "clear_port";     port: number }
  | { type: "change_approach"; hint: string }
  | { type: "escalate";       reason: string }
  | { type: "abort";          reason: string };

export interface PatchPlan {
  actions:        PatchAction[];
  estimatedFixMs: number;
  restartNeeded:  boolean;
  rollbackFirst:  boolean;
  summary:        string;
}

// ── Decision ──────────────────────────────────────────────────────────────────

export type ReflectionDecisionType =
  | "retry"
  | "patch"
  | "rollback"
  | "restart"
  | "escalate"
  | "abort";

export interface ReflectionDecision {
  decision:     ReflectionDecisionType;
  classification: ReflectionClassification;
  patchPlan:    PatchPlan;
  retryAllowed: boolean;
  retryDelayMs: number;
  reason:       string;
}

// ── Outcome ───────────────────────────────────────────────────────────────────

export interface ReflectionOutcome {
  projectId:   number;
  runId:       string;
  trigger:     ReflectionTrigger;
  decision:    ReflectionDecision;
  skipped:     boolean;
  skipReason?: string;
  elapsedMs:   number;
}

// ── Memory entry ──────────────────────────────────────────────────────────────

export interface ReflectionMemoryEntry {
  fingerprint:  string;
  failureClass: ReflectionFailureClass;
  decision:     ReflectionDecisionType;
  outcome:      "success" | "failure" | "pending";
  ts:           number;
  attempts:     number;
}
