/**
 * server/tools/coding/crud/generate-crud-ui.ts
 * Tool: coding_generate_crud_ui
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { CrudUiInput }                          from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { crudUiTemplate }                             from '../templates/crud-template.ts';
import { toPascalCase }                               from '../../../agents/coderx/utils/code-utils.ts';

export const generateCrudUITool = {
  name:        'coding_generate_crud_ui',
  category:    'coding',
  description: 'Generate a React CRUD UI component only (list + create + delete). Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name',                                       required: true  },
    fields:   { type: 'array',  description: 'Field name strings',                                   required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                       required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: CrudUiInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const fields   = input.fields.map(String);
    const Name     = toPascalCase(input.resource);
    const code     = crudUiTemplate(input.resource, fields);
    const filename = `src/components/${Name}Crud.tsx`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated CRUD UI: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
