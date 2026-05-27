/**
 * server/tools/browser/validation-core/screenshot-validator.ts
 *
 * Validates screenshot parameters before any capture attempt.
 */

const MAX_LABEL_LENGTH = 128;
const LABEL_SAFE       = /^[a-zA-Z0-9_\-]+$/;

export function validateScreenshotLabel(label: unknown): string {
  if (typeof label !== 'string' || label.trim().length === 0) {
    throw new Error('[label] Screenshot label must be a non-empty string');
  }
  const trimmed = label.trim();
  if (trimmed.length > MAX_LABEL_LENGTH) {
    throw new Error(`[label] Screenshot label too long (max ${MAX_LABEL_LENGTH})`);
  }
  if (!LABEL_SAFE.test(trimmed)) {
    throw new Error('[label] Screenshot label may only contain letters, digits, underscores, and hyphens');
  }
  return trimmed;
}

export function validateFullPage(fullPage: unknown): boolean {
  if (fullPage === undefined || fullPage === null) return true;
  if (typeof fullPage !== 'boolean') throw new Error('[fullPage] Must be a boolean');
  return fullPage;
}
