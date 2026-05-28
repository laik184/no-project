import { validateBuildResult }         from '../lib/build-validator.ts';
import type { OutputValidationResult } from '../shared/verifier-types.ts';

export { validateBuildResult };

export function isBuildClean(stdout: string, stderr: string, exitCode: number): boolean {
  return validateBuildResult(stdout, stderr, exitCode).valid;
}

export function buildValidationSummary(result: OutputValidationResult): string {
  if (result.valid) return 'Build validation passed';
  return `Build validation failed: ${result.errors.join('; ')}`;
}
