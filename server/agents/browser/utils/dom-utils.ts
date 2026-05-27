/**
 * dom-utils.ts
 * Selector normalization, element-check helpers, and safe attribute extraction.
 */

export type SelectorStrategy = 'css' | 'text' | 'role' | 'testid' | 'xpath';

export interface ParsedSelector {
  strategy: SelectorStrategy;
  value:    string;
  raw:      string;
}

export function parseSelector(selector: string): ParsedSelector {
  const trimmed = selector.trim();

  if (trimmed.startsWith('text=')) {
    return { strategy: 'text', value: trimmed.slice(5), raw: trimmed };
  }
  if (trimmed.startsWith('role=')) {
    return { strategy: 'role', value: trimmed.slice(5), raw: trimmed };
  }
  if (trimmed.startsWith('[data-testid=') || trimmed.startsWith('testid=')) {
    const val = trimmed.startsWith('testid=') ? trimmed.slice(7) : trimmed;
    return { strategy: 'testid', value: val, raw: trimmed };
  }
  if (trimmed.startsWith('//') || trimmed.startsWith('xpath=')) {
    const val = trimmed.startsWith('xpath=') ? trimmed.slice(6) : trimmed;
    return { strategy: 'xpath', value: val, raw: trimmed };
  }
  return { strategy: 'css', value: trimmed, raw: trimmed };
}

export function isSafeSelector(selector: string): boolean {
  if (!selector || selector.trim().length === 0) return false;
  // Block selectors that could escape the document context
  if (selector.includes('<script')) return false;
  if (selector.length > 512)        return false;
  return true;
}

export function buildTestIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}

export function buildRootAppSelectors(): string[] {
  return ['#root', '#app', '[id="root"]', 'main', 'body > div', 'body > section'];
}
