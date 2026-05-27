import { existsSync } from 'fs';
import path           from 'path';
import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk, toToolFail } from '../shared/verifier-result.ts';

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT ?? '.sandbox';

export interface RollbackCheck {
  checkpointExists: boolean;
  checkpointId?:    string;
  canRollback:      boolean;
  reason?:          string;
}

export function validateRollback(projectId: string, checkpointId?: string): RollbackCheck {
  const root = path.resolve(SANDBOX_ROOT, projectId);
  if (!existsSync(root)) {
    return { checkpointExists: false, canRollback: false, reason: 'Sandbox does not exist' };
  }
  if (!checkpointId) {
    return { checkpointExists: false, canRollback: false, reason: 'No checkpoint ID provided' };
  }
  const cpPath = path.join(root, '.checkpoints', checkpointId);
  const exists = existsSync(cpPath);
  return {
    checkpointExists: exists,
    checkpointId,
    canRollback:      exists,
    reason:           exists ? undefined : `Checkpoint ${checkpointId} not found`,
  };
}

export const rollbackValidatorTool: ToolDefinition = {
  name:        'validate_rollback',
  category:    'verifier',
  description: 'Check if a rollback checkpoint is available',
  inputSchema: {
    projectId:    { type: 'string', description: 'Project ID',    required: true },
    checkpointId: { type: 'string', description: 'Checkpoint ID' },
  },
  permissions: ['read'],
  timeoutMs:   3_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = validateRollback(
      input.projectId    as string,
      input.checkpointId as string | undefined,
    );
    const ms = Date.now() - start;
    return result.canRollback
      ? toToolOk(result, ms)
      : toToolFail(result.reason ?? 'Cannot rollback', ms);
  },
};
