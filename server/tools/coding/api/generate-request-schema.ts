/**
 * server/tools/coding/api/generate-request-schema.ts
 * Tool: coding_generate_request_schema
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { RequestSchemaInput }                   from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { requestSchemaTemplate }                      from '../templates/api-template.ts';
import { toKebabCase }                                from '../../shared/string-utils.ts';

export const generateRequestSchemaTool = defineCodingTool({
  name:        'coding_generate_request_schema',
  category:    'coding',
  description: 'Generate a Zod request validation schema + typed DTO. Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Schema name (e.g. CreateUser)',                required: true  },
    fields:   { type: 'array',  description: 'Array of { name, type, required? } field specs', required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: RequestSchemaInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim())    return codingFail(invalidInputError('name', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const apiFields = input.fields.map(f => ({
      name:     String(f.name),
      type:     String(f.type ?? 'string'),
      required: f.required !== false,
    }));

    const code     = requestSchemaTemplate(input.name, apiFields);
    const filename = `schemas/${toKebabCase(input.name)}-schema.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated request schema: ${filename}`, report.warnings));
  },
});
