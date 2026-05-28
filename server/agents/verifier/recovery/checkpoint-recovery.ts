/**
 * recovery/checkpoint-recovery.ts
 * Coordinates checkpoint-based recovery after verification failures.
 */

import type { ToolExecutionContext } from '../../../tools/registry/tool-types.ts';
import { runTool, VERIFIER_TOOLS } from '../coordination/tool-coordinator.ts';
import { resultError } from '../coordination/dispatcher-client.ts';
import { snapshotStore_, makeSnapshot } from '../state/snapshot-store.ts';
import { verificationStore } from '../state/verification-store.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export interface CheckpointRecoveryResult {
  restored:   boolean;
  snapshotId: string | undefined;
  errors:     string[];
  durationMs: number;
}

export async function validateAndRestoreCheckpoint(
  context: ToolExecutionContext,
): Promise<CheckpointRecoveryResult> {
  const start = Date.now();

  const record = verificationStore.get(context.runId);
  if (record) {
    snapshotStore_.save(makeSnapshot(context.runId, context.projectId, record.status, record.phases, 'pre-recovery'));
    verifierLogger.info(context.runId, 'Snapshot saved before recovery');
  }

  const result = await runTool(
    VERIFIER_TOOLS.CHECKPOINT_VALIDATE,
    { projectId: context.projectId, sandboxRoot: context.sandboxRoot, runId: context.runId },
    context,
  );

  const durationMs = Date.now() - start;

  if (!result.ok) {
    const errMsg = resultError(result);
    verifierLogger.error(context.runId, 'Checkpoint validation failed', { error: errMsg });
    return { restored: false, snapshotId: undefined, errors: [errMsg], durationMs };
  }

  verifierLogger.info(context.runId, 'Checkpoint validated and restored', { durationMs });
  return { restored: true, snapshotId: 'pre-recovery', errors: [], durationMs };
}

export function hasRecoverySnapshot(runId: string): boolean {
  return snapshotStore_.latest(runId) !== undefined;
}
