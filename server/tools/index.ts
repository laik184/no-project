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

// ── Filesystem domain (MIGRATED — fully registered) ───────────────────────────
export {
  registerFilesystemTools,
  FILESYSTEM_TOOL_COUNT,
  FILESYSTEM_TOOL_NAMES,
} from './filesystem/index.ts';

// ── Coding domain (MIGRATED — fully registered) ───────────────────────────────
export {
  registerCodingTools,
  CODING_TOOL_COUNT,
  CODING_TOOL_NAMES,
} from './coding/index.ts';

// ── Cross-category telemetry hub ──────────────────────────────────────────────
export {
  getGlobalStats,
  getToolMetrics,
  getRecentAudit,
  getTopTools,
} from './telemetry/index.ts';
