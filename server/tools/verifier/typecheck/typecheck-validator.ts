import type { ParsedError, ValidationReport }  from '../shared/verifier-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk }            from '../shared/verifier-result.ts';

export function validateTypecheckResult(
  errors:   ParsedError[],
  exitCode: number,
): ValidationReport {
  const checks = [
    {
      name:    'exit-code',
      status:  exitCode === 0 ? 'passed' : 'failed' as const,
      message: exitCode === 0 ? 'tsc exited successfully' : `tsc exited with code ${exitCode}`,
    },
    {
      name:    'no-errors',
      status:  errors.length === 0 ? 'passed' : 'failed' as const,
      message: errors.length === 0 ? 'No type errors' : `${errors.length} type error(s)`,
    },
  ];

  const errorCount   = checks.filter(c => c.status === 'failed').length;
  const warningCount = 0;
  const passedCount  = checks.filter(c => c.status === 'passed').length;

  return {
    status:       errorCount === 0 ? 'passed' : 'failed',
    checks,
    errorCount,
    warningCount,
    passedCount,
  };
}

export const typecheckValidatorTool: ToolDefinition = {
  name:        'validate_typecheck',
  category:    'verifier',
  description: 'Validate TypeScript checker results',
  inputSchema: {
    errors:   { type: 'array',  description: 'ParsedError array', required: true },
    exitCode: { type: 'number', description: 'tsc exit code',     required: true },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = validateTypecheckResult(
      input.errors   as ParsedError[],
      Number(input.exitCode),
    );
    return toToolOk(result, Date.now() - start);
  },
};
