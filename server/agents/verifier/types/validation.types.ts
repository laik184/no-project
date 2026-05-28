/**
 * types/validation.types.ts
 * Validation-specific type definitions.
 */

export type ValidationStatus = 'passed' | 'failed' | 'skipped' | 'error';

export interface ValidationCheck {
  name:        string;
  /** 'passed' | 'failed' | 'skipped' — kept as string so tools can assign freely */
  status:      string;
  message?:    string;
  durationMs?: number;
}

export interface ValidationReport {
  /** Overall pass/fail status string */
  status:       'passed' | 'failed';
  passed?:      boolean;
  checks:       ValidationCheck[];
  errors?:      string[];
  warnings?:    string[];
  errorCount:   number;
  warningCount: number;
  passedCount:  number;
}

export interface SchemaValidationResult {
  valid:       boolean;
  violations:  string[];
  /** Alias for violations — some tools use errors */
  errors:      string[];
  checkedAt:   Date;
}

export interface DependencyCheckResult {
  packageName: string;
  valid:       boolean;
  installed:   boolean;
  error?:      string;
}

export interface OutputValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}
