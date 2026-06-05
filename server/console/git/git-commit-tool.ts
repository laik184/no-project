/**
 * server/console/git/git-commit-tool.ts
 *
 * Stages all changes and commits via GitService.
 * Imports: GitService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { gitService }                           from '../../services/git/index.ts';

export interface GitCommitInput {
  message: string;
}

export interface GitCommitOutput {
  sha:     string;
  message: string;
}

export class GitCommitTool implements ConsoleTool<GitCommitInput, ConsoleToolResult<GitCommitOutput>> {
  readonly id          = 'console.git.commit';
  readonly description = 'Stages all changes and creates a git commit in the project sandbox.';

  async execute(input: GitCommitInput): Promise<ConsoleToolResult<GitCommitOutput>> {
    try {
      if (!input.message?.trim()) {
        return { ok: false, error: 'Commit message must not be empty.' };
      }
      const result = await gitService.commit(input.message.trim());
      if (!result.ok || !result.sha) return { ok: false, error: result.error };
      return { ok: true, data: { sha: result.sha, message: input.message.trim() } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const gitCommitTool = new GitCommitTool();
