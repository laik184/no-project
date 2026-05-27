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
