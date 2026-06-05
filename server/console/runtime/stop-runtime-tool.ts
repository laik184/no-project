/**
 * server/console/runtime/stop-runtime-tool.ts
 *
 * Stops the project runtime via RuntimeService.
 * Imports: RuntimeService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { runtimeService }                       from '../../services/console/index.ts';

export interface StopRuntimeInput {
  projectId: number;
}

export interface StopRuntimeOutput {
  projectId: number;
  stopped:   true;
}

export class StopRuntimeTool implements ConsoleTool<StopRuntimeInput, ConsoleToolResult<StopRuntimeOutput>> {
  readonly id          = 'console.runtime.stop';
  readonly description = 'Stops the project runtime process.';

  async execute(input: StopRuntimeInput): Promise<ConsoleToolResult<StopRuntimeOutput>> {
    try {
      runtimeService.stop(input.projectId);
      return { ok: true, data: { projectId: input.projectId, stopped: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const stopRuntimeTool = new StopRuntimeTool();
