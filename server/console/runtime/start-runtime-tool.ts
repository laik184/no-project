import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface StartRuntimeInput { projectId: number; command: string; args?: string[]; cwd?: string; env?: Record<string, string>; }
export interface StartRuntimeOutput { projectId: number; started: true; }

export class StartRuntimeTool implements ConsoleTool<StartRuntimeInput, ConsoleToolResult<StartRuntimeOutput>> {
  readonly id          = 'console.runtime.start';
  readonly description = 'Starts the project runtime process.';

  async execute(_input: StartRuntimeInput): Promise<ConsoleToolResult<StartRuntimeOutput>> {
    return { ok: false, error: 'Runtime service not available.' };
  }
}

export const startRuntimeTool = new StartRuntimeTool();
