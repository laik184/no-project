export type VerificationStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type VerificationPhase  = 'typecheck' | 'build' | 'runtime' | 'endpoints' | 'tests';

export interface EndpointSpec {
  path:           string;
  method:         'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  expectedStatus: number;
  body?:          unknown;
}

export interface VerificationInput {
  runId:      string;
  projectId:  string;
  phases:     VerificationPhase[];
  timeoutMs?: number;
  endpoints?: EndpointSpec[];
  port?:      number;
}

export interface PhaseResult {
  phase:      VerificationPhase;
  status:     VerificationStatus;
  durationMs: number;
  errors:     string[];
  warnings:   string[];
  output?:    string;
}

export interface VerificationResult {
  runId:         string;
  projectId:     string;
  overallStatus: VerificationStatus;
  phases:        PhaseResult[];
  startedAt:     Date;
  completedAt:   Date;
  durationMs:    number;
  errorCount:    number;
  warningCount:  number;
}

export interface VerificationSession {
  id:         string;
  runId:      string;
  projectId:  string;
  status:     VerificationStatus;
  startedAt:  Date;
  phases:     VerificationPhase[];
  results:    PhaseResult[];
}

export type ValidationStatus = 'passed' | 'failed' | 'skipped';

export interface ValidationCheck {
  name:     string;
  status:   ValidationStatus;
  message?: string;
  details?: string;
}

export interface ValidationReport {
  status:       ValidationStatus;
  checks:       ValidationCheck[];
  errorCount:   number;
  warningCount: number;
  passedCount:  number;
}

export interface SchemaValidationResult {
  valid:   boolean;
  errors:  string[];
  field?:  string;
}

export interface DependencyCheckResult {
  packageName:      string;
  installed:        boolean;
  version?:         string;
  expectedVersion?: string;
  valid:            boolean;
  error?:           string;
}

export interface OutputValidationResult {
  valid:    boolean;
  exitCode: number;
  errors:   string[];
  warnings: string[];
}

export type ServerState  = 'up' | 'down' | 'unknown';
export type CrashReason  = 'oom' | 'exception' | 'timeout' | 'signal' | 'unknown';

export interface RuntimeCheckResult {
  healthy:         boolean;
  state:           ServerState;
  responseTimeMs?: number;
  error?:          string;
  checkedAt:       Date;
}

export interface EndpointCheckResult {
  path:           string;
  method:         string;
  status:         number;
  expectedStatus: number;
  passed:         boolean;
  responseTimeMs: number;
  error?:         string;
  body?:          unknown;
}

export interface CrashReport {
  detected:    boolean;
  reason?:     CrashReason;
  exitCode?:   number;
  signal?:     string;
  lastLines:   string[];
  detectedAt?: Date;
}

export interface ServerHealth {
  state:     ServerState;
  pid?:      number;
  port?:     number;
  uptimeMs?: number;
  memoryMb?: number;
  checks:    RuntimeCheckResult[];
}

export type ErrorSeverity   = 'fatal' | 'error' | 'warning' | 'info';
export type FailureCategory = 'typecheck' | 'build' | 'runtime' | 'test' | 'network' | 'config' | 'unknown';

export interface StackFrame {
  file:          string;
  line:          number;
  column?:       number;
  functionName?: string;
  source?:       string;
}

export interface ParsedStackTrace {
  message:   string;
  errorType: string;
  frames:    StackFrame[];
  raw:       string;
}

export interface ParsedError {
  message:   string;
  severity:  ErrorSeverity;
  category:  FailureCategory;
  file?:     string;
  line?:     number;
  column?:   number;
  code?:     string;
  raw:       string;
}

export interface RootCause {
  category:      FailureCategory;
  description:   string;
  primaryError:  string;
  relatedErrors: string[];
  suggestedFix?: string;
}

export interface DiagnosticsReport {
  runId:      string;
  errors:     ParsedError[];
  rootCauses: RootCause[];
  summary:    string;
  severity:   ErrorSeverity;
  generatedAt: Date;
}
