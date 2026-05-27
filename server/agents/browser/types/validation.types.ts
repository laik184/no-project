/**
 * validation.types.ts
 * UI validation, console errors, visual diff, and crash report types.
 */

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface UICheck {
  name:     string;
  passed:   boolean;
  severity: ValidationSeverity;
  detail?:  string;
}

export interface UIValidationResult {
  ok:             boolean;
  url:            string;
  checks:         UICheck[];
  consoleErrors:  ConsoleError[];
  crashDetected:  boolean;
  durationMs:     number;
}

export type ConsoleErrorType =
  | 'error'
  | 'warning'
  | 'exception'
  | 'network'
  | 'hydration';

export interface ConsoleError {
  type:       ConsoleErrorType;
  message:    string;
  source?:    string;
  url?:       string;
  timestamp:  number;
}

export interface VisualDiffResult {
  hasChanges:      boolean;
  baselineExists:  boolean;
  threshold:       number;
  diffScore?:      number;
  detail?:         string;
}

export type CrashType =
  | 'react-error'
  | 'white-screen'
  | 'uncaught-exception'
  | 'page-crash';

export interface CrashReport {
  crashed:    boolean;
  type?:      CrashType;
  message?:   string;
  url:        string;
  timestamp:  number;
}

export interface PerformanceValidation {
  ok:              boolean;
  loadTimeMs:      number;
  renderTimeMs?:   number;
  thresholdMs:     number;
  withinThreshold: boolean;
}
