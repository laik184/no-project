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
