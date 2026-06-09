/**
 * server/tools/git/git-status-tool.ts
 * Tool: git_status
 *
 * Returns the working-tree status of the sandbox git repo.
 * Returns: { clean, branch, staged[], unstaged[], untracked[] }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface GitStatusResult {
  clean:     boolean;
  branch:    string;
  staged:    string[];
  unstaged:  string[];
  untracked: string[];
  raw:       string;
}

export const gitStatusTool: ToolDefinition = {
  name:        'git_status',
  category:    'terminal',
  description: 'Show the git working-tree status of the sandbox project.',
  inputSchema: {
    cwd: { type: 'string', description: 'Working directory (default: sandbox root)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<GitStatusResult> => {
    const cwd = (input.cwd as string | undefined) ?? (ctx.sandboxRoot as string | undefined) ?? '.sandbox';

    const [statusResult, branchResult] = await Promise.all([
      commandService.execute('git status --porcelain 2>&1', { cwd, timeoutMs: 8_000 }),
      commandService.execute('git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown', { cwd, timeoutMs: 5_000 }),
    ]);

    const raw    = statusResult.stdout ?? '';
    const branch = (branchResult.stdout ?? 'unknown').trim();
    const lines  = raw.split('\n').filter(Boolean);

    const staged:    string[] = [];
    const unstaged:  string[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      const status = line.slice(0, 2);
      const file   = line.slice(3).trim();
      if (status === '??') { untracked.push(file); continue; }
      if (status[0] !== ' ' && status[0] !== '?') staged.push(file);
      if (status[1] !== ' ' && status[1] !== '?') unstaged.push(file);
    }

    return {
      clean: lines.length === 0,
      branch,
      staged,
      unstaged,
      untracked,
      raw,
    };
  },
};
