/**
 * server/console/runtime/start-runtime-tool.ts
 *
 * Starts the project runtime via RuntimeService.
 * Imports: RuntimeService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { runtimeService }                       from '../../services/console/index.ts';

export interface StartRuntimeInput {
  projectId: number;
  command:   string;
  args?:     string[];
  cwd?:      string;
  env?:      Record<string, string>;
}

export interface StartRuntimeOutput {
  projectId: number;
  started:   true;
}

export class StartRuntimeTool implements ConsoleTool<StartRuntimeInput, ConsoleToolResult<StartRuntimeOutput>> {
  readonly id          = 'console.runtime.start';
  readonly description = 'Starts the project runtime process.';

  async execute(input: StartRuntimeInput): Promise<ConsoleToolResult<StartRuntimeOutput>> {
    try {
      runtimeService.start(input.projectId, {
        command: input.command,
        args:    input.args,
        cwd:     input.cwd,
        env:     input.env,
      });
      return { ok: true, data: { projectId: input.projectId, started: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const startRuntimeTool = new StartRuntimeTool();
