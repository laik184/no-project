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

// ── Domain namespaces (stubs — implementations pending migration) ─────────────
export { FILESYSTEM_TOOLS_PENDING } from './filesystem/index.ts';
export { TERMINAL_TOOLS_PENDING }   from './terminal/index.ts';
export { BROWSER_TOOLS_PENDING }    from './browser/index.ts';
export { VERIFIER_TOOLS_PENDING }   from './verifier/index.ts';
export { CODING_TOOLS_PENDING }     from './coding/index.ts';
