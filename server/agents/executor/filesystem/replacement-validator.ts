/**
 * replacement-validator.ts
 * Validates patch operations before they touch the filesystem.
 */

import { validateFilePath } from '../validation/file-integrity.ts';

export interface PatchValidationResult {
  valid:  boolean;
  reason: string;
}

const OK: PatchValidationResult = { valid: true, reason: 'ok' };
const fail = (reason: string): PatchValidationResult => ({ valid: false, reason });

export function validatePatch(
  filePath:  string,
  oldString: string,
  newString: string,
): PatchValidationResult {
  const pathCheck = validateFilePath(filePath);
  if (!pathCheck.valid) return fail(`Invalid path: ${pathCheck.reason}`);

  if (typeof oldString !== 'string' || oldString.length === 0) {
    return fail('old_string must be a non-empty string');
  }

  if (typeof newString !== 'string') {
    return fail('new_string must be a string');
  }

  if (oldString === newString) {
    return fail('old_string and new_string are identical — no change would be made');
  }

  if (oldString.length > 50_000) {
    return fail('old_string exceeds 50 KB — use write_file for full rewrites');
  }

  if (newString.length > 100_000) {
    return fail('new_string exceeds 100 KB — split into smaller edits');
  }

  return OK;
}
