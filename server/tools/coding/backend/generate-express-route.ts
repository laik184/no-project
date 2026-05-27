/**
 * server/tools/coding/backend/generate-express-route.ts
 * Tool: coding_generate_express_route
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ExpressRouteInput }                    from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { expressRouteTemplate }                       from '../templates/express-template.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils.ts';

export const generateExpressRouteTool = {
  name:        'coding_generate_express_route',
  category:    'coding',
  description: 'Generate an Express router module. Returns file map — does not write to disk.',
  inputSchema: {
    name:        { type: 'string', description: 'Route name (e.g. users)',                  required: true  },
    prefix:      { type: 'string', description: 'Mount prefix (e.g. /api/users)',           required: true  },
    middlewares: { type: 'array',  description: 'Middleware function names to apply',       required: false },
    strategy:    { type: 'string', description: '"template" (default) | "llm"',             required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ExpressRouteInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim())   return codingFail(invalidInputError('name', 'required').message);
    if (!input.prefix?.trim()) return codingFail(invalidInputError('prefix', 'required').message);

    const mw       = Array.isArray(input.middlewares) ? input.middlewares : [];
    const code     = expressRouteTemplate(input.name, input.prefix, mw);
    const filename = `routes/${toKebabCase(input.name)}.ts`;
    const files    = { [filename]: code };

    const report   = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated Express route: ${filename} (${input.prefix})`, report.warnings));
  },
} as unknown as ToolDefinition;
