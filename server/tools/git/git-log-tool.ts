/**
 * server/tools/git/git-log-tool.ts
 * Tool: git_log
 *
 * Returns recent commit history for the sandbox repo.
 * Returns: { commits[], total }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface GitCommitEntry {
  hash:    string;
  date:    string;
  author:  string;
  message: string;
}

export interface GitLogResult {
  commits: GitCommitEntry[];
  total:   number;
}

export const gitLogTool: ToolDefinition = {
  name:        'git_log',
  category:    'terminal',
  description: 'Show recent git commit history for the sandbox project.',
  inputSchema: {
    limit: { type: 'number', description: 'Max commits to return (default: 10)', required: false },
    cwd:   { type: 'string',  description: 'Working directory (default: sandbox root)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<GitLogResult> => {
    const cwd   = (input.cwd as string | undefined) ?? (ctx.sandboxRoot as string | undefined) ?? '.sandbox';
    const limit = (input.limit as number | undefined) ?? 10;

    const result = await commandService.execute(
      `git log --oneline --pretty=format:"%H|%ai|%an|%s" -${limit} 2>&1`,
      { cwd, timeoutMs: 8_000 },
    );

    const lines   = (result.stdout ?? '').split('\n').filter(Boolean);
    const commits = lines.map(line => {
      const [hash, date, author, ...msgParts] = line.split('|');
      return { hash: hash ?? '', date: date ?? '', author: author ?? '', message: msgParts.join('|') };
    });

    return { commits, total: commits.length };
  },
};
