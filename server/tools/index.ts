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

// ── Domain namespaces (stubs — pending migration) ─────────────────────────────
export { BROWSER_TOOLS_PENDING }    from './browser/index.ts';
export { CODING_TOOLS_PENDING }     from './coding/index.ts';
