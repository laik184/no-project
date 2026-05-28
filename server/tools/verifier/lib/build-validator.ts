import type { OutputValidationResult } from './verifier-types.ts';
import { parseBuildErrors }            from './build-error-parser.ts';

export function validateBuildResult(stdout: string, stderr: string, exitCode: number): OutputValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (exitCode !== 0) {
    errors.push(`Build exited with code ${exitCode}`);
    const parsed = parseBuildErrors([stdout, stderr].join('\n'));
    errors.push(...parsed.filter((e) => e.severity === 'error' || e.severity === 'fatal').map((e) => e.message));
    warnings.push(...parsed.filter((e) => e.severity === 'warning').map((e) => e.message));
  }

  return { valid: errors.length === 0, errors, warnings };
}
