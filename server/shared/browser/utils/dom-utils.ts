/**
 * server/agents/browser/utils/dom-utils.ts
 *
 * DOM selector validation and common selectors.
 * Pure string/regex utilities — no Playwright access.
 */

// ── Dangerous selector patterns ───────────────────────────────────────────────

const UNSAFE_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /on\w+\s*=/i,           // onerror=, onclick=, ...
  /<script/i,
  /\\\\/,                  // backslash sequences
];

const MAX_SELECTOR_LEN = 512;

/**
 * Returns true if the selector looks safe to pass to Playwright.
 * Rejects empty strings, excessively long selectors, and injection patterns.
 */
export function isSafeSelector(selector: string): boolean {
  if (!selector || selector.trim().length === 0) return false;
  if (selector.length > MAX_SELECTOR_LEN)         return false;
  return !UNSAFE_PATTERNS.some(p => p.test(selector));
}

// ── Root app selectors ────────────────────────────────────────────────────────

/**
 * Returns an ordered list of common root app selectors.
 * Used by ui-validator.ts to confirm a React/Vue/Angular app has mounted.
 */
export function buildRootAppSelectors(): string[] {
  return [
    '#root',
    '#app',
    '#__next',
    '[data-reactroot]',
    'main',
    '.app',
    '.app-root',
    'body > div',
  ];
}

// ── Selector helpers ──────────────────────────────────────────────────────────

/**
 * Escapes special CSS characters in an attribute value.
 */
export function escapeCssValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/**
 * Builds a CSS attribute selector.
 */
export function attrSelector(attr: string, value: string): string {
  return `[${attr}="${escapeCssValue(value)}"]`;
}

/**
 * Returns true if the selector looks like an XPath expression.
 */
export function isXPath(selector: string): boolean {
  return selector.startsWith('/') || selector.startsWith('./');
}

/**
 * Normalises a selector — trims whitespace, collapses multiple spaces.
 */
export function normalizeSelector(selector: string): string {
  return selector.trim().replace(/\s+/g, ' ');
}
