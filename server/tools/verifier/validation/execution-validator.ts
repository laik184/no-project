import {
  validateExecution,
  validateExitCode,
} from '../../../agents/verifier/validation/execution-validator.ts';
import type { ValidationReport } from '../shared/verifier-types.ts';
import type { ToolDefinition }   from '../../registry/tool-types.ts';
import { toToolOk, toToolFail }  from '../shared/verifier-result.ts';

export { validateExecution, validateExitCode };

export const executionValidatorTool: ToolDefinition = {
  name:        'validate_execution',
  category:    'verifier',
  description: 'Validate the result of a command execution',
  inputSchema: {
    exitCode: { type: 'number', description: 'Exit code',  required: true },
    stdout:   { type: 'string', description: 'stdout',     required: true },
    stderr:   { type: 'string', description: 'stderr' },
    command:  { type: 'string', description: 'Command run' },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = validateExecution({
      exitCode: Number(input.exitCode),
      stdout:   input.stdout  as string,
      stderr:   (input.stderr as string) ?? '',
      command:  (input.command as string) ?? '',
    });
    const ms = Date.now() - start;
    return result.valid
      ? toToolOk(result, ms)
      : toToolFail(result.errors.join('; '), ms, 'VALIDATION_ERROR');
  },
};
