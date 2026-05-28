import { validateBuildOutput, validateCommandOutput } from '../lib/output-validator.ts';
import type { OutputValidationResult }                from '../shared/verifier-types.ts';
import type { ToolDefinition }                        from '../../registry/tool-types.ts';
import { toToolOk, toToolFail }                       from '../shared/verifier-result.ts';

export { validateBuildOutput, validateCommandOutput };

export function validateOutput(stdout: string, stderr: string, exitCode: number): OutputValidationResult {
  return validateCommandOutput(stdout, stderr, exitCode);
}

export const outputValidatorTool: ToolDefinition = {
  name:        'validate_output',
  category:    'verifier',
  description: 'Validate command output for errors and warnings',
  inputSchema: {
    stdout:   { type: 'string', description: 'stdout',    required: true },
    stderr:   { type: 'string', description: 'stderr' },
    exitCode: { type: 'number', description: 'Exit code', required: true },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = validateCommandOutput(
      input.stdout   as string,
      (input.stderr  as string) ?? '',
      Number(input.exitCode),
    );
    const ms = Date.now() - start;
    return result.valid
      ? toToolOk(result, ms)
      : toToolFail(result.errors.join('; '), ms, 'VALIDATION_ERROR');
  },
};
