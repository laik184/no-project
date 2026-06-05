import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface TerminalInput { projectId: number; command: string; args?: string[]; cwd?: string; env?: Record<string, string>; }
export interface TerminalOutput { pid?: number; running: boolean; startedAt: number; }

export class TerminalTool implements ConsoleTool<TerminalInput, ConsoleToolResult<TerminalOutput>> {
  readonly id          = 'console.terminal.run';
  readonly description = 'Runs a shell command inside the project sandbox.';

  async execute(_input: TerminalInput): Promise<ConsoleToolResult<TerminalOutput>> {
    return { ok: false, error: 'Terminal service not available.' };
  }
}

export const terminalTool = new TerminalTool();
