/**
 * server/tools/checkpoint/restore-checkpoint-tool.ts
 *
 * Restores a previously created checkpoint via CheckpointService.
 *
 * Imports: CheckpointService only — no infra, no repo, no DB.
 */

import type { Tool, ToolResult } from '../contracts/tool.ts';
import { checkpointService }     from '../../services/checkpoint/index.ts';

export interface RestoreCheckpointInput {
  sha: string;
}

export interface RestoreCheckpointOutput {
  sha:      string;
  restored: true;
}

export class RestoreCheckpointTool implements Tool<RestoreCheckpointInput, ToolResult<RestoreCheckpointOutput>> {
  readonly id          = 'checkpoint.restore';
  readonly description = 'Restores the project to a previously saved checkpoint snapshot.';

  async execute(input: RestoreCheckpointInput): Promise<ToolResult<RestoreCheckpointOutput>> {
    try {
      if (!input.sha?.trim()) {
        return { ok: false, error: 'Checkpoint SHA must not be empty.' };
      }
      const result = await checkpointService.restore(input.sha.trim());
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, data: { sha: input.sha.trim(), restored: true } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const restoreCheckpointTool = new RestoreCheckpointTool();
