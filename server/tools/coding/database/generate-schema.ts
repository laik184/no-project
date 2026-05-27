/**
 * server/tools/coding/database/generate-schema.ts
 * Tool: coding_generate_schema
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { SchemaInput }                          from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { crudSchemaTemplate }                         from '../templates/crud-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

export const generateSchemaTool = {
  name:        'coding_generate_schema',
  category:    'coding',
  description: 'Generate a Drizzle ORM table schema + Zod insert schema. Returns file map — does not write to disk.',
  inputSchema: {
    table:    { type: 'string', description: 'Table/entity name (e.g. user)',                       required: true  },
    fields:   { type: 'array',  description: 'Array of { name, type, nullable? } field specs',      required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                        required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: SchemaInput, ctx: ToolExecutionContext) => {
    if (!input.table?.trim()) return codingFail(invalidInputError('table', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const typedFields = input.fields.map(f => ({
      name: String(f.name),
      type: String(f.type ?? 'string'),
    }));

    const code     = crudSchemaTemplate(input.table, typedFields);
    const filename = `shared/${toKebabCase(input.table)}-schema.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated Drizzle schema: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
