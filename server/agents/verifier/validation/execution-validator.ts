import type { OutputValidationResult } from '../types/validation.types.ts';
import type { ExecutionResult } from '../../terminal/types/execution.types.ts';

const CRASH_PATTERNS = [
  /uncaught exception/i,
  /unhandled rejection/i,
  /segmentation fault/i,
  /process exited with code [^0]/i,
  /fatal error/i,
];

const WARNING_PATTERNS = [
  /deprecation warning/i,
  /experimentalwarning/i,
  /npm warn/i,
];

export function validateExecution(result: ExecutionResult): OutputValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];
  const combined = `${result.stdout}\n${result.stderr}`;

  if (result.exitCode !== 0) {
    errors.push(`Process exited with code ${result.exitCode}`);
  }

  for (const pattern of CRASH_PATTERNS) {
    if (pattern.test(combined)) {
      errors.push(`Crash pattern detected: ${pattern.source}`);
    }
  }

  for (const pattern of WARNING_PATTERNS) {
    if (pattern.test(combined)) {
      warnings.push(`Warning pattern: ${pattern.source}`);
    }
  }

  return { valid: errors.length === 0, exitCode: result.exitCode, errors, warnings };
}

export function validateExitCode(exitCode: number): OutputValidationResult {
  const errors = exitCode !== 0 ? [`Non-zero exit code: ${exitCode}`] : [];
  return { valid: exitCode === 0, exitCode, errors, warnings: [] };
}
