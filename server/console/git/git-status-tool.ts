/**
 * server/console/git/git-status-tool.ts
 *
 * Returns git status of the sandbox via GitService.
 * Imports: GitService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { gitService }                           from '../../services/git/index.ts';
import type { GitStatusCode }                   from '../../services/git/index.ts';

export interface GitStatusInput {
  _?: never;
}

export interface GitStatusOutput {
  isRepo: boolean;
  files:  Record<string, GitStatusCode>;
}

export class GitStatusTool implements ConsoleTool<GitStatusInput, ConsoleToolResult<GitStatusOutput>> {
  readonly id          = 'console.git.status';
  readonly description = 'Returns the current git status of the project sandbox.';

  async execute(_input: GitStatusInput): Promise<ConsoleToolResult<GitStatusOutput>> {
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
