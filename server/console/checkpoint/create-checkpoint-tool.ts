import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';

export interface CreateCheckpointInput { label: string; }
export interface CheckpointEntry { sha: string; label: string; createdAt: number; }
export interface CreateCheckpointOutput { entry: CheckpointEntry; }

export class CreateCheckpointTool implements ConsoleTool<CreateCheckpointInput, ConsoleToolResult<CreateCheckpointOutput>> {
  readonly id          = 'console.checkpoint.create';
  readonly description = 'Creates a named checkpoint snapshot of the current project state.';

  async execute(_input: CreateCheckpointInput): Promise<ConsoleToolResult<CreateCheckpointOutput>> {
    return { ok: false, error: 'Checkpoint service not available.' };
  }
}

export const createCheckpointTool = new CreateCheckpointTool();
