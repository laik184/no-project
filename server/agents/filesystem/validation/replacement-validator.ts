import { validateFileContent } from './integrity-validator.ts';

export class ReplacementValidationError extends Error {
  constructor(message: string) {
    super(`[replacement-validator] ${message}`);
    this.name = 'ReplacementValidationError';
  }
}

export interface ReplacementValidationResult {
  valid: boolean;
  occurrences?: number;
  error?: string;
}

const MAX_REPLACEMENT_SIZE = 1 * 1024 * 1024; // 1 MB per replacement

export function validateReplacement(
  fileContent: string,
  oldString: string,
  newString: string,
): ReplacementValidationResult {
  if (!oldString || typeof oldString !== 'string') {
    return { valid: false, error: 'oldString must be a non-empty string' };
  }
  if (typeof newString !== 'string') {
    return { valid: false, error: 'newString must be a string' };
  }
  if (newString.length > MAX_REPLACEMENT_SIZE) {
    return { valid: false, error: `newString exceeds maximum size of ${MAX_REPLACEMENT_SIZE} bytes` };
  }

  const occurrences = fileContent.split(oldString).length - 1;
  if (occurrences === 0) {
    return { valid: false, error: 'oldString was not found in file content — check exact whitespace and formatting', occurrences: 0 };
  }

  const contentResult = validateFileContent(newString);
  if (!contentResult.valid) {
    return { valid: false, error: `newString invalid: ${contentResult.error}` };
  }

  const estimatedNewSize = fileContent.length - oldString.length * occurrences + newString.length * occurrences;
  if (estimatedNewSize > 10 * 1024 * 1024) {
    return { valid: false, error: 'Replacement would produce a file exceeding 10 MB' };
  }

  return { valid: true, occurrences };
}

export function assertReplacement(fileContent: string, oldString: string, newString: string): number {
  const result = validateReplacement(fileContent, oldString, newString);
  if (!result.valid) throw new ReplacementValidationError(result.error!);
  return result.occurrences!;
}

export function validateSingleReplacement(
  fileContent: string,
  oldString: string,
  newString: string,
): ReplacementValidationResult {
  const base = validateReplacement(fileContent, oldString, newString);
  if (!base.valid) return base;
  if (base.occurrences! > 1) {
    return {
      valid: false,
      occurrences: base.occurrences,
      error: `oldString appears ${base.occurrences} times — use patchAll for global replace or make oldString more specific`,
    };
  }
  return base;
}

export function assertSingleReplacement(fileContent: string, oldString: string, newString: string): void {
  const result = validateSingleReplacement(fileContent, oldString, newString);
  if (!result.valid) throw new ReplacementValidationError(result.error!);
}
