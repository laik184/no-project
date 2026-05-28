/**
 * server/tools/verifier/lib/verifier-types.ts
 * Consolidated type definitions for the verifier layer.
 */

// ── Verification lifecycle ─────────────────────────────────────────────────────

export type VerificationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'aborted';

export type VerificationPhase =
  | 'build' | 'typecheck' | 'tests' | 'runtime' | 'endpoints'
  | 'dependencies' | 'validation' | 'recovery' | 'diagnostics';

export interface EndpointSpec {
  path:           string;
  method:         string;
  expectedStatus: number;
  body?:          Record<string, unknown>;
  headers?:       Record<string, string>;
}

export interface VerificationInput {
  runId:       string;
  projectId:   string;
  sandboxRoot: string;
  phases:      VerificationPhase[];
  port?:       number;
  endpoints?:  EndpointSpec[];
  timeoutMs?:  number;
}

export interface PhaseResult {
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  errors:     string[];
  warnings?:  string[];
  output?:    string;
}

export interface VerificationResult {
  runId:       string;
  status:      VerificationStatus;
  durationMs:  number;
  phases:      PhaseResult[];
  passed:      boolean;
  errors:      string[];
}

export interface VerificationSession {
  runId:     string;
  projectId: string;
  status:    VerificationStatus;
  phase:     VerificationPhase | 'idle';
  startedAt: Date;
}

// ── Diagnostics ────────────────────────────────────────────────────────────────

export type ErrorSeverity   = 'fatal' | 'error' | 'warning' | 'info';
export type FailureCategory = 'build' | 'type' | 'test' | 'runtime' | 'dependency' | 'unknown';

export interface StackFrame {
  file:     string;
  line:     number;
  column:   number;
  fn:       string;
  internal: boolean;
}

export interface ParsedStackTrace {
  frames:   StackFrame[];
  original: string;
  message:  string;
}

export interface ParsedError {
  message:  string;
  severity: ErrorSeverity;
  category: FailureCategory;
  file?:    string;
  line?:    number;
  column?:  number;
  code?:    string;
}

export interface RootCause {
  category:    FailureCategory;
  description: string;
  errors:      ParsedError[];
  actionable:  string;
}

export interface DiagnosticsReport {
  runId:      string;
  errors:     ParsedError[];
  rootCauses: RootCause[];
  summary:    string;
  createdAt:  number;
}

// ── Runtime ────────────────────────────────────────────────────────────────────

export type ServerState   = 'starting' | 'ready' | 'unhealthy' | 'crashed' | 'unknown';
export type CrashReason   = 'exit_code' | 'oom' | 'uncaught_exception' | 'eaddrinuse' | 'timeout' | 'unknown';

export interface ServerHealth {
  state:     ServerState;
  port?:     number;
  latencyMs: number;
  checkedAt: number;
}

export interface RuntimeCheckResult {
  healthy:    boolean;
  error?:     string;
  health:     ServerHealth;
  statusCode?: number;
}

export interface EndpointCheckResult {
  path:           string;
  method:         string;
  expectedStatus: number;
  actualStatus?:  number;
  success:        boolean;
  latencyMs:      number;
  error?:         string;
}

export interface CrashReport {
  reason:    CrashReason;
  message:   string;
  exitCode?: number;
  stack?:    string;
  timestamp: number;
}

// ── Validation ─────────────────────────────────────────────────────────────────

export type ValidationStatus = 'pass' | 'fail' | 'skip';

export interface ValidationCheck {
  name:    string;
  status:  ValidationStatus;
  message: string;
}

export interface ValidationReport {
  checks:  ValidationCheck[];
  passed:  number;
  failed:  number;
  valid:   boolean;
  errors:  string[];
}

export interface SchemaValidationResult {
  valid:  boolean;
  errors: string[];
}

export interface DependencyCheckResult {
  packageName: string;
  valid:       boolean;
  installed:   boolean;
  version?:    string;
  error?:      string;
}

export interface OutputValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}
