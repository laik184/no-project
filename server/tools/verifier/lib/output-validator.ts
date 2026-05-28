import type { OutputValidationResult } from './verifier-types.ts';
import { parseBuildErrors }            from './build-error-parser.ts';

export function validateCommandOutput(stdout: string, stderr: string, exitCode: number): OutputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (exitCode !== 0) {
    const summary = (stderr || stdout).slice(0, 300).trim();
    errors.push(`Command exited with code ${exitCode}: ${summary || '(no output)'}`);
  }
  const parsed = parseBuildErrors(stderr);
  warnings.push(...parsed.filter((e) => e.severity === 'warning').map((e) => e.message));
  return { valid: errors.length === 0, errors, warnings };
}

export function validateBuildOutput(stdout: string, stderr: string, exitCode: number): OutputValidationResult {
  return validateCommandOutput(stdout, stderr, exitCode);
}
