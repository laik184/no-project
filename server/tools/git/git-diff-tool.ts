/**
 * server/tools/git/git-diff-tool.ts
 * Tool: git_diff
 *
 * Returns the diff for staged or unstaged changes in the sandbox.
 * Returns: { diff, linesAdded, linesRemoved, filesChanged }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface GitDiffResult {
  diff:         string;
  linesAdded:   number;
  linesRemoved: number;
  filesChanged: number;
}

export const gitDiffTool: ToolDefinition = {
  name:        'git_diff',
  category:    'terminal',
  description: 'Show git diff for staged or unstaged changes in the sandbox project.',
  inputSchema: {
    staged: { type: 'boolean', description: 'If true, show staged (--cached) diff', required: false },
    file:   { type: 'string',  description: 'Specific file to diff (optional)',      required: false },
    cwd:    { type: 'string',  description: 'Working directory (default: sandbox root)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<GitDiffResult> => {
    const cwd    = (input.cwd as string | undefined) ?? (ctx.sandboxRoot as string | undefined) ?? '.sandbox';
    const staged = (input.staged as boolean | undefined) ? '--cached' : '';
    const file   = (input.file as string | undefined) ?? '';

    const cmd    = `git diff ${staged} ${file} 2>&1 | head -500`.trim();
    const result = await commandService.execute(cmd, { sandboxRoot: cwd, timeoutMs: 10_000 });

    const diff   = result.stdout ?? '';
    const lines  = diff.split('\n');
    const added   = lines.filter(l => l.startsWith('+')).length;
    const removed = lines.filter(l => l.startsWith('-')).length;
    const files   = lines.filter(l => l.startsWith('diff --git')).length;

    return { diff, linesAdded: added, linesRemoved: removed, filesChanged: files };
  },
};
