/**
 * server/tools/coding/backend/generate-middleware.ts
 * Tool: coding_generate_middleware
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { MiddlewareInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { expressMiddlewareTemplate }                  from '../templates/express-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

const DEFAULT_LOGIC = `  // Add middleware logic here\n  next();`;

export const generateMiddlewareTool = {
  name:        'coding_generate_middleware',
  category:    'coding',
  description: 'Generate an Express middleware function. Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Middleware name (e.g. rateLimiter, logger)', required: true  },
    logic:    { type: 'string', description: 'TypeScript body of the middleware function', required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',              required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: MiddlewareInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) return codingFail(invalidInputError('name', 'required').message);

    const logic    = input.logic?.trim() || DEFAULT_LOGIC;
    const code     = expressMiddlewareTemplate(input.name, logic);
    const filename = `middleware/${toKebabCase(input.name)}.ts`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated middleware: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
