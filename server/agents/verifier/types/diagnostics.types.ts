/**
 * types/diagnostics.types.ts
 * Diagnostics and error analysis types.
 */

export type ErrorSeverity   = 'fatal' | 'error' | 'warning' | 'info';
export type FailureCategory =
  | 'typecheck'
  | 'build'
  | 'runtime'
  | 'test'
  | 'network'
  | 'config'
  | 'dependency'
  | 'unknown';

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
  runId:       string;
  errors:      ParsedError[];
  rootCauses:  RootCause[];
  summary:     string;
  severity:    ErrorSeverity;
  generatedAt: Date;
}

export interface FailureSummary {
  total:       number;
  fatal:       number;
  errors:      number;
  warnings:    number;
  categories:  Partial<Record<FailureCategory, number>>;
  topErrors:   string[];
  hasCritical: boolean;
}

export interface DiagnosticsInput {
  runId:   string;
  errors:  ParsedError[];
  rawLogs: string;
}

export interface ClassifiedFailure {
  category:   FailureCategory;
  severity:   ErrorSeverity;
  message:    string;
  suggestedFix?: string;
}

export interface StackFrame {
  fn:   string;
  file: string;
  line: number;
  col:  number;
}

export interface ParsedStackTrace {
  message: string;
  frames:  StackFrame[];
  raw:     string;
}
