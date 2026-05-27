/**
 * server/tools/coding/backend/generate-service.ts
 * Tool: coding_generate_service
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ServiceInput }                         from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { expressServiceTemplate }                     from '../templates/express-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils.ts';

export const generateServiceTool = {
  name:        'coding_generate_service',
  category:    'coding',
  description: 'Generate a typed service layer with in-memory store. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name (e.g. user)',                  required: true  },
    fields:   { type: 'array',  description: 'Field names for the resource data shape',    required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',              required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ServiceInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);

    const fields   = Array.isArray(input.fields) ? input.fields : [];
    const code     = expressServiceTemplate(input.resource, fields);
    const filename = `services/${toKebabCase(input.resource)}-service.ts`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated service: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
