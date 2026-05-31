/**
 * server/agents/coderx/utils.ts
 *
 * Backward-compatibility re-export shim.
 *
 * String utilities (toPascalCase, toCamelCase, toKebabCase, etc.) have been
 * moved to server/tools/shared/string-utils.ts to break Tool → Agent imports.
 *
 * This file re-exports from the new canonical location so existing agent-layer
 * consumers continue to work without changes.
 *
 * Migration path:
 *   OLD: import { toPascalCase } from '../../agents/coderx/utils.ts'
 *   NEW: import { toPascalCase } from '../../tools/shared/string-utils.ts'
 */

export {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  pluralize,
  capitalize,
  truncate,
} from '../../tools/index.ts';

export * from './utils/coding-utils.ts';
