/**
 * server/tools/browser/validation-core/selector-validator.ts
 *
 * Validates CSS / Playwright selectors before they touch the DOM.
 * Fail-closed: invalid selectors are rejected before any browser call.
 */

const MAX_SELECTOR_LENGTH = 512;

export interface SelectorValidation {
  valid:   boolean;
  reason?: string;
}

export function validateSelector(selector: unknown): SelectorValidation {
  if (typeof selector !== 'string') {
    return { valid: false, reason: 'Selector must be a string' };
  }
  if (selector.trim().length === 0) {
    return { valid: false, reason: 'Selector must not be empty' };
  }
  if (selector.length > MAX_SELECTOR_LENGTH) {
    return { valid: false, reason: `Selector exceeds max length (${MAX_SELECTOR_LENGTH})` };
  }
  if (selector.includes('<script')) {
    return { valid: false, reason: 'Selector contains disallowed content' };
  }
  return { valid: true };
}

export function assertSelector(selector: unknown, field = 'selector'): string {
  const v = validateSelector(selector);
  if (!v.valid) throw new Error(`[${field}] ${v.reason}`);
  return (selector as string).trim();
}
