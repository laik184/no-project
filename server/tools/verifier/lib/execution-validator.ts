import type { ValidationReport, ValidationCheck } from './verifier-types.ts';

export interface ExecutionValidationInput {
  exitCode: number;
  stdout:   string;
  stderr:   string;
  command:  string;
}

export function validateExecution(input: ExecutionValidationInput): ValidationReport {
  const checks: ValidationCheck[] = [];

  checks.push({
    name:    'exit_code',
    status:  input.exitCode === 0 ? 'pass' : 'fail',
    message: input.exitCode === 0 ? 'Exited cleanly' : `Exit code ${input.exitCode}`,
  });

  const hasOutput = input.stdout.trim().length > 0 || input.stderr.trim().length > 0;
  checks.push({
    name:    'output_present',
    status:  hasOutput ? 'pass' : 'skip',
    message: hasOutput ? 'Output present' : 'No output produced',
  });

  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;
  const errors = checks.filter((c) => c.status === 'fail').map((c) => c.message);

  return { checks, passed, failed, valid: failed === 0, errors };
}

export function validateExitCode(exitCode: number): boolean {
  return exitCode === 0;
}
