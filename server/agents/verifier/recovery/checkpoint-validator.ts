/**
 * recovery/checkpoint-validator.ts
 * Validates and manages project checkpoints for recovery.
 * Called by server/tools/verifier/recovery/checkpoint-validator.ts.
 */

export interface CheckpointValidationResult {
  valid:      boolean;
  count:      number;
  errors:     string[];
  details?:   string;
}

export interface CheckpointEntry {
  id:           string;
  runId:        string;
  projectId:    string;
  createdAt:    Date;
  sandboxRoot:  string;
}

const checkpoints = new Map<string, CheckpointEntry[]>();

export function validateCheckpoints(
  runId:       string,
  minRequired = 1,
): CheckpointValidationResult {
  const all  = Array.from(checkpoints.values()).flat();
  const mine = all.filter((c) => c.runId === runId);

  if (mine.length < minRequired) {
    return {
      valid:   false,
      count:   mine.length,
      errors:  [`Only ${mine.length} checkpoint(s) found, minimum is ${minRequired}`],
      details: `Run ${runId} has insufficient checkpoints`,
    };
  }

  return { valid: true, count: mine.length, errors: [], details: `${mine.length} checkpoint(s) validated` };
}

export function saveCheckpoint(entry: CheckpointEntry): void {
  if (!checkpoints.has(entry.projectId)) checkpoints.set(entry.projectId, []);
  const list = checkpoints.get(entry.projectId)!;
  list.push(entry);
  if (list.length > 10) list.shift();
}

export function getLatestCheckpoint(projectId: string): CheckpointEntry | undefined {
  return checkpoints.get(projectId)?.at(-1);
}

/** @deprecated — use validateCheckpoints */
export function validateCheckpoint(projectId: string, runId: string): CheckpointValidationResult {
  return validateCheckpoints(runId, 1);
}
