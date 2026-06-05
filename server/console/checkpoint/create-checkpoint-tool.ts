/**
 * server/console/checkpoint/create-checkpoint-tool.ts
 *
 * Creates a named checkpoint snapshot via CheckpointService.
 * Imports: CheckpointService only — no infra, no repo, no DB.
 */

import type { ConsoleTool, ConsoleToolResult } from '../registry/tool-registry.ts';
import { checkpointService }                    from '../../services/checkpoint/index.ts';
import type { CheckpointEntry }                 from '../../services/checkpoint/index.ts';

export interface CreateCheckpointInput {
  label: string;
}

export interface CreateCheckpointOutput {
  entry: CheckpointEntry;
}

export class CreateCheckpointTool implements ConsoleTool<CreateCheckpointInput, ConsoleToolResult<CreateCheckpointOutput>> {
  readonly id          = 'console.checkpoint.create';
  readonly description = 'Creates a named checkpoint snapshot of the current project state.';

  async execute(input: CreateCheckpointInput): Promise<ConsoleToolResult<CreateCheckpointOutput>> {
    try {
      if (!input.label?.trim()) {
        return { ok: false, error: 'Checkpoint label must not be empty.' };
      }
      const result = await checkpointService.create(input.label.trim());
      if (!result.ok || !result.entry) return { ok: false, error: result.error };
      return { ok: true, data: { entry: result.entry } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const createCheckpointTool = new CreateCheckpointTool();
