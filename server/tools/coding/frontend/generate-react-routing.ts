/**
 * server/tools/coding/frontend/generate-react-routing.ts
 * Tool: coding_generate_react_routing
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ReactRoutingInput }                    from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { reactRoutingTemplate }                       from '../templates/react-template.ts';

export const generateReactRoutingTool = {
  name:        'coding_generate_react_routing',
  category:    'coding',
  description: 'Generate a wouter-based React routing module. Returns file map — does not write to disk.',
  inputSchema: {
    routes:   { type: 'array',  description: 'Array of { path: string, component: string } route specs', required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                             required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ReactRoutingInput, ctx: ToolExecutionContext) => {
    if (!Array.isArray(input.routes) || input.routes.length === 0) {
      return codingFail(invalidInputError('routes', 'must be a non-empty array').message);
    }

    const valid = input.routes.every(
      r => typeof r.path === 'string' && typeof r.component === 'string',
    );
    if (!valid) {
      return codingFail(invalidInputError('routes', 'each entry must have { path: string, component: string }').message);
    }

    const code    = reactRoutingTemplate(input.routes);
    const files   = { 'src/routes.tsx': code };
    const report  = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated routing module with ${input.routes.length} route(s)`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;
