/**
 * server/tools/browser/validation-core/interaction-validator.ts
 *
 * Validates interaction inputs (values, timeouts) before DOM calls.
 */

const MAX_FILL_VALUE_LENGTH = 10_000;
const MIN_TIMEOUT_MS        = 100;
const MAX_TIMEOUT_MS        = 30_000;
const DEFAULT_TIMEOUT_MS    = 5_000;

export function validateFillValue(value: unknown): string {
  if (typeof value !== 'string') throw new Error('[value] Fill value must be a string');
  if (value.length > MAX_FILL_VALUE_LENGTH) {
    throw new Error(`[value] Fill value too long (max ${MAX_FILL_VALUE_LENGTH})`);
  }
  return value;
}

export function validateSelectValue(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('[value] Select value must be a non-empty string');
  }
  return value;
}

export function clampInteractionTimeout(timeoutMs: unknown): number {
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs)) return DEFAULT_TIMEOUT_MS;
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, timeoutMs));
}
