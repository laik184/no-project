import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface GitCommitInput { message: string; }
export interface GitCommitOutput { sha: string; message: string; }

export class GitCommitTool implements ConsoleTool<GitCommitInput, ConsoleToolResult<GitCommitOutput>> {
  readonly id          = 'console.git.commit';
  readonly description = 'Stages all changes and creates a git commit in the project sandbox.';

  async execute(_input: GitCommitInput): Promise<ConsoleToolResult<GitCommitOutput>> {
    return { ok: false, error: 'Git service not available.' };
  }
}

export const gitCommitTool = new GitCommitTool();
