/**
 * server/tools/coding/api/generate-api-validation.ts
 * Tool: coding_generate_api_validation
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ApiValidationInput }                   from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toCamelCase, toKebabCase }     from '../../../agents/coderx/utils.ts';

function apiValidationTemplate(resource: string, fields: string[]): string {
  const Name      = toPascalCase(resource);
  const schemaVar = `${toCamelCase(resource)}Schema`;
  const zodFields = fields.map(f => `  ${f}: z.string().min(1, '${f} is required'),`).join('\n');
  return `import { z } from 'zod';
import { type Request, type Response, type NextFunction } from 'express';

const ${schemaVar} = z.object({
${zodFields}
});

export type Validated${Name} = z.infer<typeof ${schemaVar}>;

export function validate${Name}Body(
  req:  Request,
  res:  Response,
  next: NextFunction,
): void {
  const result = ${schemaVar}.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      ok:     false,
      error:  'Validation failed',
      issues: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }
  (req as Request & { validated?: Validated${Name} }).validated = result.data;
  next();
}
`;
}

export const generateApiValidationTool = {
  name:        'coding_generate_api_validation',
  category:    'coding',
  description: 'Generate a Zod-based Express request validation middleware for a resource. Returns file map — does not write to disk.',
  inputSchema: {
    resource: { type: 'string', description: 'Resource name (e.g. post)',          required: true  },
    fields:   { type: 'array',  description: 'Required field name strings',         required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',       required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ApiValidationInput, ctx: ToolExecutionContext) => {
    if (!input.resource?.trim()) return codingFail(invalidInputError('resource', 'required').message);
    if (!Array.isArray(input.fields) || input.fields.length === 0) {
      return codingFail(invalidInputError('fields', 'must be a non-empty array').message);
    }

    const code     = apiValidationTemplate(input.resource, input.fields.map(String));
    const filename = `middleware/validate-${toKebabCase(input.resource)}.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated API validation middleware: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
