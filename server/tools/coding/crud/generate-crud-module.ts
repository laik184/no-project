/**
 * server/tools/coding/crud/generate-crud-module.ts
 * Tool: coding_generate_crud_module
 *
 * Generates a complete CRUD module: schema + API router + UI component.
 * Returns all files as a map — does not write to disk.
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { CrudModuleInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { crudApiTemplate, crudUiTemplate, crudSchemaTemplate } from '../templates/crud-template.ts';
import { toKebabCase, toPascalCase }                  from '../../../agents/coderx/utils.ts';

export const generateCrudModuleTool = {
  name:        'coding_generate_crud_module',
  category:    'coding',
  description: 'Generate a complete CRUD module: Drizzle schema + Express API router + React UI. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name (e.g. post, product)',          required: true  },
    fields:   { type: 'array',  description: 'Field name strings (e.g. ["title","body"])',  required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',               required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_ONCE,

  handler: async (input: CrudModuleInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const resource = input.resource;
    const fields   = input.fields.map(String);
    const kebab    = toKebabCase(resource);
    const Name     = toPascalCase(resource);

    const typedFields = fields.map(f => ({ name: f, type: 'string' }));

    const files: Record<string, string> = {
      [`shared/${kebab}-schema.ts`]:           crudSchemaTemplate(resource, typedFields),
      [`routes/${kebab}.ts`]:                  crudApiTemplate(resource, fields),
      [`src/components/${Name}Crud.tsx`]:      crudUiTemplate(resource, fields),
    };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated CRUD module for "${Name}": schema + API + UI (${Object.keys(files).length} files)`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;
