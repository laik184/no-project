/**
 * server/tools/coding/api/generate-response-schema.ts
 * Tool: coding_generate_response_schema
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ResponseSchemaInput }                  from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { responseSchemaTemplate }                     from '../templates/api-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

export const generateResponseSchemaTool = {
  name:        'coding_generate_response_schema',
  category:    'coding',
  description: 'Generate TypeScript response shape interfaces (single + list + error). Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Response entity name (e.g. User)',        required: true  },
    fields:   { type: 'array',  description: 'Array of { name, type } field specs',     required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',           required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ResponseSchemaInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim())    return codingFail(invalidInputError('name', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const apiFields = input.fields.map(f => ({
      name: String(f.name),
      type: String(f.type ?? 'string'),
    }));

    const code     = responseSchemaTemplate(input.name, apiFields);
    const filename = `types/${toKebabCase(input.name)}-response.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated response schema: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
