import type { Checkpoint } from '../../terminal/recovery/checkpoint-manager.ts';
import { checkpointManager } from '../../terminal/recovery/checkpoint-manager.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export interface CheckpointValidationResult {
  valid:      boolean;
  checkpoints: Checkpoint[];
  errors:     string[];
  latestId?:  string;
}

export function validateCheckpoints(
  runId:   string,
  minRequired = 1,
): CheckpointValidationResult {
  const checkpoints = checkpointManager.getForRun(runId);
  const errors: string[] = [];

  if (checkpoints.length < minRequired) {
    errors.push(`Expected at least ${minRequired} checkpoint(s), found ${checkpoints.length}`);
  }

  const sorted = [...checkpoints].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  verifierLogger.info(runId, '[checkpoint-validator] Validated', {
    count:  checkpoints.length,
    valid:  errors.length === 0,
  });

  return {
    valid:       errors.length === 0,
    checkpoints: sorted,
    errors,
    latestId:    sorted[0]?.id,
  };
}

export function getLatestCheckpoint(runId: string): Checkpoint | undefined {
  const checkpoints = checkpointManager.getForRun(runId);
  return checkpoints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}
