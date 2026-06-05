import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface GitRestoreInput { filePath?: string; }
export interface GitRestoreOutput { restored: string; }

export class GitRestoreTool implements ConsoleTool<GitRestoreInput, ConsoleToolResult<GitRestoreOutput>> {
  readonly id          = 'console.git.restore';
  readonly description = 'Discards unstaged changes for a file or the entire sandbox.';

  async execute(_input: GitRestoreInput): Promise<ConsoleToolResult<GitRestoreOutput>> {
    return { ok: false, error: 'Git service not available.' };
  }
}

export const gitRestoreTool = new GitRestoreTool();
