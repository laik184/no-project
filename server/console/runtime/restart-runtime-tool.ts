import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface RestartRuntimeInput { projectId: number; command: string; args?: string[]; cwd?: string; env?: Record<string, string>; }
export interface RestartRuntimeOutput { projectId: number; restarted: true; }

export class RestartRuntimeTool implements ConsoleTool<RestartRuntimeInput, ConsoleToolResult<RestartRuntimeOutput>> {
  readonly id          = 'console.runtime.restart';
  readonly description = 'Restarts the project runtime process.';

  async execute(_input: RestartRuntimeInput): Promise<ConsoleToolResult<RestartRuntimeOutput>> {
    return { ok: false, error: 'Runtime service not available.' };
  }
}

export const restartRuntimeTool = new RestartRuntimeTool();
