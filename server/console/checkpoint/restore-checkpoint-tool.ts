import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface RestoreCheckpointInput { sha: string; }
export interface RestoreCheckpointOutput { sha: string; restored: true; }

export class RestoreCheckpointTool implements ConsoleTool<RestoreCheckpointInput, ConsoleToolResult<RestoreCheckpointOutput>> {
  readonly id          = 'console.checkpoint.restore';
  readonly description = 'Restores the project to a previously saved checkpoint snapshot.';

  async execute(_input: RestoreCheckpointInput): Promise<ConsoleToolResult<RestoreCheckpointOutput>> {
    return { ok: false, error: 'Checkpoint service not available.' };
  }
}

export const restoreCheckpointTool = new RestoreCheckpointTool();
