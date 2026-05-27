/**
 * server/tools/coding/database/generate-model.ts
 * Tool: coding_generate_model
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ModelInput }                           from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toKebabCase }                  from '../../../agents/coderx/utils.ts';

function modelTemplate(name: string, fields: Array<{ name: string; type: string }>): string {
  const Name      = toPascalCase(name);
  const fieldDecl = fields.map(f => `  ${f.name}: ${f.type};`).join('\n');
  const createDecl = fields.map(f => `  ${f.name}: ${f.type};`).join('\n');
  return `export interface ${Name} {
  id: string;
${fieldDecl}
  createdAt: string;
  updatedAt: string;
}

export interface Create${Name}Dto {
${createDecl}
}

export interface Update${Name}Dto {
${fields.map(f => `  ${f.name}?: ${f.type};`).join('\n')}
}

export type ${Name}Id = string;
`;
}

export const generateModelTool = {
  name:        'coding_generate_model',
  category:    'coding',
  description: 'Generate TypeScript model interfaces (entity + DTO types). Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Model name (e.g. User, Post)',              required: true  },
    fields:   { type: 'array',  description: 'Array of { name, type } field specs',       required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',             required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ModelInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) return codingFail(invalidInputError('name', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const typedFields = input.fields.map(f => ({
      name: String(f.name),
      type: String(f.type ?? 'string'),
    }));
    const code     = modelTemplate(input.name, typedFields);
    const filename = `types/${toKebabCase(input.name)}.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated model types: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
