/**
 * server/tools/git/git-status-tool.ts
 *
 * Returns the current git status of the sandbox via GitService.
 *
 * Imports: GitService only — no infra, no repo, no DB.
 */

import type { Tool, ToolResult }            from '../contracts/tool.ts';
import { gitService }                       from '../../services/git/index.ts';
import type { GitStatusCode }               from '../../services/git/index.ts';

export interface GitStatusInput {
  _?: never;
}

export interface GitStatusOutput {
  isRepo: boolean;
  files:  Record<string, GitStatusCode>;
}

export class GitStatusTool implements Tool<GitStatusInput, ToolResult<GitStatusOutput>> {
  readonly id          = 'git.status';
  readonly description = 'Returns the current git status of the project sandbox.';

  async execute(_input: GitStatusInput): Promise<ToolResult<GitStatusOutput>> {
    try {
      const [isRepo, statusResult] = await Promise.all([
        gitService.isRepo(),
        gitService.status(),
      ]);
      if (!statusResult.ok) return { ok: false, error: statusResult.error };
      return { ok: true, data: { isRepo, files: statusResult.files } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const gitStatusTool = new GitStatusTool();
