import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export type GitStatusCode = 'M' | 'A' | 'D' | 'R' | '?' | '!';
export interface GitStatusInput { _?: never; }
export interface GitStatusOutput { isRepo: boolean; files: Record<string, GitStatusCode>; }

export class GitStatusTool implements ConsoleTool<GitStatusInput, ConsoleToolResult<GitStatusOutput>> {
  readonly id          = 'console.git.status';
  readonly description = 'Returns the current git status of the project sandbox.';

  async execute(_input: GitStatusInput): Promise<ConsoleToolResult<GitStatusOutput>> {
    return { ok: false, error: 'Git service not available.' };
  }
}

export const gitStatusTool = new GitStatusTool();
