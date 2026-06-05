/**
 * server/tools/runtime/stop-runtime-tool.ts
 *
 * Stops the project runtime via RuntimeService.
 *
 * Imports: RuntimeService only — no infra, no repo, no DB.
 */

import type { Tool, ToolResult } from '../contracts/tool.ts';
import { runtimeService }        from '../../services/console/index.ts';

export interface StopRuntimeInput {
  projectId: number;
}

export interface StopRuntimeOutput {
  projectId: number;
  stopped:   true;
}

export class StopRuntimeTool implements Tool<StopRuntimeInput, ToolResult<StopRuntimeOutput>> {
  readonly id          = 'runtime.stop';
  readonly description = 'Stops the project runtime process.';

  async execute(input: StopRuntimeInput): Promise<ToolResult<StopRuntimeOutput>> {
    try {
      runtimeService.stop(input.projectId);
      return { ok: true, data: { projectId: input.projectId, stopped: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const stopRuntimeTool = new StopRuntimeTool();
