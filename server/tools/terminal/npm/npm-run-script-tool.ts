/**
 * server/tools/terminal/npm/npm-run-script-tool.ts
 * Tool: terminal_npm_run_script
 *
 * Runs `npm run <script>` in the sandbox.
 */

import type { ToolDefinition, ToolExecutionContext } from '../contracts/index.ts';
import { RETRY_NONE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { commandService }                            from '../../../services/terminal/index.ts';

export const npmRunScriptTool: ToolDefinition = {
  name:        'terminal_npm_run_script',
  category:    'terminal',
  description: 'Run an npm script (npm run <script>) in the sandbox.',
  inputSchema: {
    script:    { type: 'string', description: 'Script name to run (e.g. "dev", "build")', required: true  },
    cwd:       { type: 'string', description: 'Working directory relative to sandbox root', required: false },
    timeoutMs: { type: 'number', description: 'Max execution time in ms (default 60 000)',  required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.LONG,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext) => {
    const script = String(input.script ?? 'start').trim();
    return commandService.execute(`npm run ${script}`, {
      cwd:         input.cwd as string | undefined,
      sandboxRoot: ctx.sandboxRoot,
      timeoutMs:   input.timeoutMs ? Number(input.timeoutMs) : 60_000,
    });
  },
};
