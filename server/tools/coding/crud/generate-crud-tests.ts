/**
 * server/tools/coding/crud/generate-crud-tests.ts
 * Tool: coding_generate_crud_tests
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { CrudTestsInput }                       from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { crudTestsTemplate }                          from '../templates/crud-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils.ts';

export const generateCrudTestsTool = {
  name:        'coding_generate_crud_tests',
  category:    'coding',
  description: 'Generate Vitest CRUD integration tests for an API resource. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name (e.g. post)',                     required: true  },
    fields:   { type: 'array',  description: 'Field name strings (for test body)',             required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                 required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: CrudTestsInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);

    const fields   = Array.isArray(input.fields) ? input.fields.map(String) : ['name'];
    const code     = crudTestsTemplate(input.resource, fields);
    const filename = `tests/${toKebabCase(input.resource)}.test.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated CRUD tests: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
