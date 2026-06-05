/**
 * server/tools/terminal/terminal-tool.ts
 *
 * Runs an arbitrary shell command inside the sandbox via ProcessService.
 *
 * Imports: ProcessService only — no infra, no repo, no DB.
 */

import type { Tool, ToolResult } from '../contracts/tool.ts';
import { processService }        from '../../services/console/index.ts';

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

export class TerminalTool implements Tool<TerminalInput, ToolResult<TerminalOutput>> {
  readonly id          = 'terminal.run';
  readonly description = 'Runs a shell command inside the project sandbox.';

  async execute(input: TerminalInput): Promise<ToolResult<TerminalOutput>> {
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
