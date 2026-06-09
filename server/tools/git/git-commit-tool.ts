/**
 * server/tools/git/git-commit-tool.ts
 * Tool: git_commit
 *
 * Creates a commit in the sandbox repo with the given message.
 * Returns: { committed, commitHash, output }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';
import { commandService }                            from '../../services/terminal/index.ts';

export interface GitCommitResult {
  committed:  boolean;
  commitHash: string;
  output:     string;
}

export const gitCommitTool: ToolDefinition = {
  name:        'git_commit',
  category:    'terminal',
  description: 'Create a git commit in the sandbox repo with the given message.',
  inputSchema: {
    message: { type: 'string', description: 'Commit message', required: true },
    cwd:     { type: 'string', description: 'Working directory (default: sandbox root)', required: false },
  },
  permissions: ['execute'],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, ctx: ToolExecutionContext): Promise<GitCommitResult> => {
    const cwd     = (input.cwd as string | undefined) ?? (ctx.sandboxRoot as string | undefined) ?? '.sandbox';
    const message = String(input.message ?? 'chore: agent commit');

    // Configure git user if not set (required for commit to work in CI-like envs)
    await commandService.execute(
      'git config user.email "agent@nurax.ai" && git config user.name "NURAX Agent" 2>/dev/null || true',
      { sandboxRoot: cwd, timeoutMs: 3_000 },
    );

    const result = await commandService.execute(
      `git commit -m ${JSON.stringify(message)} 2>&1`,
      { sandboxRoot: cwd, timeoutMs: 10_000 },
    );

    const output    = (result.stdout ?? '') + (result.stderr ?? '');
    const committed = (result.exitCode ?? 1) === 0;

    // Extract short hash from output like "[main abc1234]"
    const hashMatch = output.match(/\[[\w/]+ ([a-f0-9]{6,})\]/);
    const commitHash = hashMatch?.[1] ?? '';

    return { committed, commitHash, output };
  },
};
