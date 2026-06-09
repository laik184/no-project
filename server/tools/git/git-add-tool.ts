/**
 * server/tools/git/git-add-tool.ts
 * Tool: git_add
 *
 * Stages file(s) for commit in the sandbox repo.
 * Returns: { staged, output }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface GitAddResult {
  staged: boolean;
  output: string;
}

export const gitAddTool: ToolDefinition = {
  name:        'git_add',
  category:    'terminal',
  description: 'Stage file(s) for commit. Use path="." to stage all changes.',
  inputSchema: {
    path: { type: 'string', description: 'File or pattern to stage (default: ".")', required: false },
    cwd:  { type: 'string', description: 'Working directory (default: sandbox root)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<GitAddResult> => {
    const cwd    = (input.cwd as string | undefined) ?? (ctx.sandboxRoot as string | undefined) ?? '.sandbox';
    const path   = (input.path as string | undefined) ?? '.';
    const result = await commandService.execute(`git add ${path} 2>&1`, { sandboxRoot: cwd, timeoutMs: 8_000 });
    return {
      staged: (result.exitCode ?? 0) === 0,
      output: (result.stdout ?? '') + (result.stderr ?? ''),
    };
  },
};
