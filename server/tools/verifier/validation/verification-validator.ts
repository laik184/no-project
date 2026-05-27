import type { VerificationInput, ValidationReport } from '../shared/verifier-types.ts';
import { validateVerificationInput }                from './schema-validator.ts';
import type { ToolDefinition }                      from '../../registry/tool-types.ts';
import { toToolOk, toToolFail }                     from '../shared/verifier-result.ts';

const VALID_PHASES = new Set(['typecheck', 'build', 'runtime', 'endpoints', 'tests']);

export function validateVerificationRequest(input: unknown): ValidationReport {
  const schema = validateVerificationInput(input);
  if (!schema.valid) {
    return {
      status:       'failed',
      checks:       schema.errors.map(e => ({ name: 'schema', status: 'failed' as const, message: e })),
      errorCount:   schema.errors.length,
      warningCount: 0,
      passedCount:  0,
    };
  }

  const typed = input as VerificationInput;
  const checks = typed.phases.map(p => ({
    name:    `phase-${p}`,
    status:  VALID_PHASES.has(p) ? 'passed' as const : 'failed' as const,
    message: VALID_PHASES.has(p) ? `Phase "${p}" is valid` : `Unknown phase: "${p}"`,
  }));

  const errorCount  = checks.filter(c => c.status === 'failed').length;
  const passedCount = checks.filter(c => c.status === 'passed').length;

  return {
    status:       errorCount === 0 ? 'passed' : 'failed',
    checks,
    errorCount,
    warningCount: 0,
    passedCount,
  };
}

export const verificationValidatorTool: ToolDefinition = {
  name:        'validate_verification_request',
  category:    'verifier',
  description: 'Validate a VerificationInput before execution',
  inputSchema: {
    input: { type: 'object', description: 'VerificationInput to validate', required: true },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = validateVerificationRequest(input.input);
    const ms     = Date.now() - start;
    return result.status === 'passed'
      ? toToolOk(result, ms)
      : toToolFail(result.checks.find(c => c.status === 'failed')?.message ?? 'Invalid input', ms, 'VALIDATION_ERROR');
  },
};
