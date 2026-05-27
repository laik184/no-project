/**
 * server/tools/index.ts
 *
 * Top-level public entry point for the centralized tool system.
 *
 * Import pattern for consumers:
 *   import { dispatch, registerTool, buildContext } from '../../tools/index.ts';
 *
 * Domain tools (filesystem, terminal, etc.) will be exported
 * from here once their migration phases are complete.
 */

// ── Registry layer (always available) ─────────────────────────────────────────
export * from './registry/index.ts';

// ── Shared utilities ──────────────────────────────────────────────────────────
export { buildContext, buildSystemContext } from './shared/context-builder.ts';
export { validateInput, applyDefaults }     from './shared/input-validator.ts';
export { ok, fail, isOk, isFail, unwrapOrThrow, unwrapOrDefault } from './shared/result-helpers.ts';
export { toolsLogger }                      from './shared/logger.ts';

// ── Filesystem domain (MIGRATED — fully registered) ──────────────────────────
export {
  registerFilesystemTools,
  FILESYSTEM_TOOL_COUNT,
  FILESYSTEM_TOOL_NAMES,
} from './filesystem/index.ts';

// ── Terminal domain (MIGRATED) ────────────────────────────────────────────────
export { registerTerminalTools } from './terminal/index.ts';

// ── Verifier domain (MIGRATED) ────────────────────────────────────────────────
export { registerVerifierTools }    from './verifier/index.ts';

// ── Browser domain (MIGRATED — fully registered) ──────────────────────────────
export {
  registerBrowserTools,
  BROWSER_TOOL_COUNT,
  BROWSER_TOOL_NAMES,
} from './browser/index.ts';

// ── Coding domain (MIGRATED — fully registered) ───────────────────────────────
export {
  registerCodingTools,
  CODING_TOOL_COUNT,
  CODING_TOOL_NAMES,
} from './coding/index.ts';

// ── Codegen alias (Fix #14 — semantic rename, backward-compat) ────────────────
// New code should import from './codegen/index.ts' — same symbols, clearer name.
// Types only re-exported here to avoid duplicate value exports with coding/index.ts above.
export type { GenerationResult, GenerationStrategy } from './codegen/index.ts';
export { CodingToolError }       from './codegen/index.ts';
export { validateGeneratedCode } from './codegen/index.ts';
export { validateAllSyntax }     from './codegen/index.ts';
export { validateAllImports }    from './codegen/index.ts';
export { validateAllSchemas }    from './codegen/index.ts';

// ── Cross-category telemetry hub (Fix #11) ────────────────────────────────────
export {
  getGlobalStats,
  getToolMetrics,
  getRecentAudit,
  getTopTools,
} from './telemetry/index.ts';

// ── Type-safe tool definition helper (Fix #15) ────────────────────────────────
export { defineTool, defineCodingTool } from './registry/define-tool.ts';
