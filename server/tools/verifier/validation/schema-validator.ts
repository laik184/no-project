import {
  validateSchema,
  type SchemaField,
} from '../../../agents/verifier/validation/schema-validator.ts';
import type { SchemaValidationResult } from '../shared/verifier-types.ts';
import type { ToolDefinition }         from '../../registry/tool-types.ts';
import { toToolOk, toToolFail }        from '../shared/verifier-result.ts';

export { validateSchema, type SchemaField };

export function validateVerificationInput(input: unknown): SchemaValidationResult {
  return validateSchema(input, [
    { key: 'runId',     type: 'string', required: true },
    { key: 'projectId', type: 'string', required: true },
    { key: 'phases',    type: 'array',  required: true },
  ]);
}

export const schemaValidatorTool: ToolDefinition = {
  name:        'validate_schema',
  category:    'verifier',
  description: 'Validate data against a field schema',
  inputSchema: {
    data:   { type: 'object', description: 'Data to validate', required: true },
    fields: { type: 'array',  description: 'SchemaField array', required: true },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = validateSchema(input.data, input.fields as SchemaField[]);
    const ms     = Date.now() - start;
    return result.valid ? toToolOk(result, ms) : toToolFail(result.errors.join('; '), ms, 'VALIDATION_ERROR');
  },
};
