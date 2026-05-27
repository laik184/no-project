/**
 * server/tools/coding/crud/generate-crud-api.ts
 * Tool: coding_generate_crud_api
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { CrudApiInput }                         from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { crudApiTemplate }                            from '../templates/crud-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

export const generateCrudApiTool = {
  name:        'coding_generate_crud_api',
  category:    'coding',
  description: 'Generate an Express CRUD API router only (no UI, no schema). Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name',                               required: true  },
    fields:   { type: 'array',  description: 'Field name strings',                           required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',               required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: CrudApiInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const fields   = input.fields.map(String);
    const code     = crudApiTemplate(input.resource, fields);
    const filename = `routes/${toKebabCase(input.resource)}.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated CRUD API router: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
