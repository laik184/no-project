/**
 * server/tools/index.ts
 *
 * Top-level public entry point for the centralized tool system.
 *
 * Import pattern for consumers:
 *   import { dispatch, registerTool, buildContext } from '../../tools/index.ts';
 */

// ── Registry layer (always available) ─────────────────────────────────────────
export * from './registry/index.ts';

// ── Contracts (Tool interface + clean ToolRegistry) ───────────────────────────
export type { Tool, ToolResult, AnyTool } from './contracts/index.ts';
export { toolRegistry }                   from './contracts/index.ts';

// ── Shared utilities ──────────────────────────────────────────────────────────
export { buildContext, buildSystemContext } from './shared/context-builder.ts';
export { validateInput, applyDefaults }     from './shared/input-validator.ts';
export { ok, fail, isOk, isFail, unwrapOrThrow, unwrapOrDefault } from './shared/result-helpers.ts';
export { toolsLogger }                      from './shared/logger.ts';
export {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  pluralize,
  capitalize,
  truncate,
} from './shared/string-utils.ts';

// ── Filesystem domain ─────────────────────────────────────────────────────────
export {
  registerFilesystemTools,
  FILESYSTEM_TOOL_COUNT,
  FILESYSTEM_TOOL_NAMES,
} from './filesystem/index.ts';

// ── Coding domain ─────────────────────────────────────────────────────────────
export {
  registerCodingTools,
  CODING_TOOL_COUNT,
  CODING_TOOL_NAMES,
} from './coding/index.ts';

// ── Terminal domain ───────────────────────────────────────────────────────────
export {
  registerTerminalTools,
  TERMINAL_TOOL_COUNT,
  TERMINAL_TOOL_NAMES,
} from './terminal/index.ts';
