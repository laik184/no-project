/**
 * server/console/terminal/terminal-tool.ts
 *
 * Runs a shell command in the sandbox via ProcessService.
 * Imports: ProcessService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { processService }                       from '../../services/console/index.ts';

export interface TerminalInput {
  projectId: number;
  command:   string;
  args?:     string[];
  cwd?:      string;
  env?:      Record<string, string>;
}

export interface TerminalOutput {
  pid?:      number;
  running:   boolean;
  startedAt: number;
}

export class TerminalTool implements ConsoleTool<TerminalInput, ConsoleToolResult<TerminalOutput>> {
  readonly id          = 'console.terminal.run';
  readonly description = 'Runs a shell command inside the project sandbox.';

  async execute(input: TerminalInput): Promise<ConsoleToolResult<TerminalOutput>> {
    try {
      const info = processService.start({
        projectId: input.projectId,
        command:   input.command,
        args:      input.args,
        cwd:       input.cwd,
        env:       input.env,
      });
      return { ok: true, data: info };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const terminalTool = new TerminalTool();
