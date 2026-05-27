/**
 * server/tools/coding/crud/generate-crud-schema.ts
 * Tool: coding_generate_crud_schema
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { CrudSchemaInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { crudSchemaTemplate }                         from '../templates/crud-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils.ts';

export const generateCrudSchemaTool = {
  name:        'coding_generate_crud_schema',
  category:    'coding',
  description: 'Generate a Drizzle ORM schema + Zod insert schema for a CRUD resource. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name',                                        required: true  },
    fields:   { type: 'array',  description: 'Array of { name, type } field specs',                  required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                         required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: CrudSchemaInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const typedFields = input.fields.map(f => ({
      name: String(f.name),
      type: String(f.type ?? 'string'),
    }));
    const code     = crudSchemaTemplate(input.resource, typedFields);
    const filename = `shared/${toKebabCase(input.resource)}-schema.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated CRUD schema: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
