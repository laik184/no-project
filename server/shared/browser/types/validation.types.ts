/**
 * server/agents/browser/types/validation.types.ts
 * UI validation, console error, and performance types.
 */

export type ConsoleErrorType = 'error' | 'warning' | 'info' | 'debug';
export type CrashType        = 'runtime' | 'navigation' | 'resource' | 'unhandled';

export interface ConsoleError {
  type:    ConsoleErrorType;
  message: string;
  source?: string;
  ts:      string;
}

export interface UICheck {
  selector: string;
  label:    string;
  ok:       boolean;
  reason?:  string;
}

export interface UIValidationResult {
  ok:       boolean;
  checks:   UICheck[];
  errors:   ConsoleError[];
  summary:  string;
  durationMs: number;
}

export interface CrashReport {
  type:    CrashType;
  message: string;
  url?:    string;
  ts:      string;
}

export interface VisualDiffResult {
  label:       string;
  diffPercent: number;
  passed:      boolean;
  diffPath?:   string;
}

export interface PerformanceValidation {
  ok:           boolean;
  ttfbMs:       number;
  loadMs:       number;
  thresholdMs:  number;
  violations:   string[];
}
