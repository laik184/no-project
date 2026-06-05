/**
 * server/console/runtime/restart-runtime-tool.ts
 *
 * Restarts the project runtime via RuntimeService.
 * Imports: RuntimeService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { runtimeService }                       from '../../services/console/index.ts';

export interface RestartRuntimeInput {
  projectId: number;
  command:   string;
  args?:     string[];
  cwd?:      string;
  env?:      Record<string, string>;
}

export interface RestartRuntimeOutput {
  projectId: number;
  restarted: true;
}

export class RestartRuntimeTool implements ConsoleTool<RestartRuntimeInput, ConsoleToolResult<RestartRuntimeOutput>> {
  readonly id          = 'console.runtime.restart';
  readonly description = 'Restarts the project runtime process.';

  async execute(input: RestartRuntimeInput): Promise<ConsoleToolResult<RestartRuntimeOutput>> {
    try {
      runtimeService.restart(input.projectId, {
        command: input.command,
        args:    input.args,
        cwd:     input.cwd,
        env:     input.env,
      });
      return { ok: true, data: { projectId: input.projectId, restarted: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const restartRuntimeTool = new RestartRuntimeTool();
