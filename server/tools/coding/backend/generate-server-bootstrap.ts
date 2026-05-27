/**
 * server/tools/coding/backend/generate-server-bootstrap.ts
 * Tool: coding_generate_server_bootstrap
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { ServerBootstrapInput }                 from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { expressServerTemplate }                      from '../templates/express-template.ts';

export const generateServerBootstrapTool = {
  name:        'coding_generate_server_bootstrap',
  category:    'coding',
  description: 'Generate an Express server entry point (server.ts). Returns file map — does not write to disk.',
  inputSchema: {
    port:     { type: 'number', description: 'Server port (default: 3000)',                      required: false },
    routes:   { type: 'array',  description: 'Array of { prefix: string, module: string } specs', required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                     required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: ServerBootstrapInput, ctx: ToolExecutionContext) => {
    const port   = typeof input.port === 'number' ? input.port : 3000;
    const routes = Array.isArray(input.routes)
      ? input.routes.filter(r => r.prefix && r.module)
      : [];

    const code    = expressServerTemplate(port, routes);
    const files   = { 'server.ts': code };
    const report  = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated Express server bootstrap on port ${port} with ${routes.length} route(s)`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;
