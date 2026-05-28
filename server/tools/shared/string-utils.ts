/**
 * server/tools/shared/string-utils.ts
 *
 * Shared string transformation utilities used across the tool layer.
 * Moved from server/agents/coderx/utils.ts to break Tool → Agent imports.
 *
 * Consumers: server/tools/coding/*
 * agents/coderx/utils.ts re-exports from here for backward compatibility.
 */

export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}

export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

export function pluralize(word: string): string {
  if (!word) return word;
  const lower = word.toLowerCase();
  if (
    lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z') ||
    lower.endsWith('ch') || lower.endsWith('sh')
  ) {
    return word + 'es';
  }
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(lower)) {
    return word.slice(0, -1) + 'ies';
  }
  return word + 's';
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, max = 120): string {
  return str.length <= max ? str : str.slice(0, max) + '…';
}
