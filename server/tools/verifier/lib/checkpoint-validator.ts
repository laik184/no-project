export interface CheckpointValidationResult {
  valid:     boolean;
  runId:     string;
  count:     number;
  required:  number;
  errors:    string[];
}

const checkpointStore = new Map<string, number>();

export function recordCheckpoint(runId: string): void {
  checkpointStore.set(runId, (checkpointStore.get(runId) ?? 0) + 1);
}

export function validateCheckpoints(runId: string, minRequired = 1): CheckpointValidationResult {
  const count  = checkpointStore.get(runId) ?? 0;
  const valid  = count >= minRequired;
  const errors = valid ? [] : [`Run ${runId} has ${count} checkpoints, need ${minRequired}`];
  return { valid, runId, count, required: minRequired, errors };
}
