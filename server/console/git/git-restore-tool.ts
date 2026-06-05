/**
 * server/console/git/git-restore-tool.ts
 *
 * Discards unstaged changes via GitService.
 * Imports: GitService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { gitService }                           from '../../services/git/index.ts';

export interface GitRestoreInput {
  filePath?: string;
}

export interface GitRestoreOutput {
  restored: string;
}

export class GitRestoreTool implements ConsoleTool<GitRestoreInput, ConsoleToolResult<GitRestoreOutput>> {
  readonly id          = 'console.git.restore';
  readonly description = 'Discards unstaged changes for a file or the entire sandbox.';

  async execute(input: GitRestoreInput): Promise<ConsoleToolResult<GitRestoreOutput>> {
    try {
      const result = await gitService.restore(input.filePath);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, data: { restored: input.filePath ?? '.' } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const gitRestoreTool = new GitRestoreTool();
