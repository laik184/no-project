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
