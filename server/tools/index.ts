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
export { terminalTool }                          from './terminal/index.ts';
export type { TerminalInput, TerminalOutput }    from './terminal/index.ts';

// ── Package domain ────────────────────────────────────────────────────────────
export { installPackageTool, uninstallPackageTool }            from './package/index.ts';
export type { InstallPackageInput, InstallPackageOutput,
              UninstallPackageInput, UninstallPackageOutput }  from './package/index.ts';

// ── Runtime domain ────────────────────────────────────────────────────────────
export { startRuntimeTool, restartRuntimeTool, stopRuntimeTool }        from './runtime/index.ts';
export type { StartRuntimeInput, StartRuntimeOutput,
              RestartRuntimeInput, RestartRuntimeOutput,
              StopRuntimeInput, StopRuntimeOutput }                      from './runtime/index.ts';

// ── Git domain ────────────────────────────────────────────────────────────────
export { gitStatusTool, gitCommitTool, gitRestoreTool }                 from './git/index.ts';
export type { GitStatusInput, GitStatusOutput,
              GitCommitInput, GitCommitOutput,
              GitRestoreInput, GitRestoreOutput }                        from './git/index.ts';

// ── Checkpoint domain ─────────────────────────────────────────────────────────
export { createCheckpointTool, restoreCheckpointTool }                  from './checkpoint/index.ts';
export type { CreateCheckpointInput, CreateCheckpointOutput,
              RestoreCheckpointInput, RestoreCheckpointOutput }          from './checkpoint/index.ts';

// ── Preview domain ────────────────────────────────────────────────────────────
export { openPreviewTool }                                               from './preview/index.ts';
export type { OpenPreviewInput, OpenPreviewOutput }                      from './preview/index.ts';

// ── Cross-category telemetry hub ──────────────────────────────────────────────
export {
  getGlobalStats,
  getToolMetrics,
  getRecentAudit,
  getTopTools,
} from './telemetry/index.ts';
