import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface StopRuntimeInput { projectId: number; }
export interface StopRuntimeOutput { projectId: number; stopped: true; }

export class StopRuntimeTool implements ConsoleTool<StopRuntimeInput, ConsoleToolResult<StopRuntimeOutput>> {
  readonly id          = 'console.runtime.stop';
  readonly description = 'Stops the project runtime process.';

  async execute(_input: StopRuntimeInput): Promise<ConsoleToolResult<StopRuntimeOutput>> {
    return { ok: false, error: 'Runtime service not available.' };
  }
}

export const stopRuntimeTool = new StopRuntimeTool();
