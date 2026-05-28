import {
  validateCheckpoints,
  type CheckpointValidationResult,
} from '../lib/checkpoint-validator.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk, toToolFail } from '../shared/verifier-result.ts';

export type { CheckpointValidationResult };

export const checkpointValidatorTool: ToolDefinition = {
  name:        'validate_checkpoint',
  category:    'verifier',
  description: 'Validate that sufficient execution checkpoints exist for a run',
  inputSchema: {
    runId:       { type: 'string', description: 'Run ID',                              required: true },
    minRequired: { type: 'number', description: 'Minimum required checkpoints (default: 1)' },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = validateCheckpoints(
      input.runId     as string,
      input.minRequired ? Number(input.minRequired) : 1,
    );
    const ms = Date.now() - start;
    return result.valid ? toToolOk(result, ms) : toToolFail(result.errors.join('; '), ms);
  },
};
