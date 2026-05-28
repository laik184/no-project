/**
 * server/agents/filesystem/index.ts
 *
 * Public barrel for the filesystem agent.
 * Consumers import from here — never from internal sub-modules directly.
 */

// ── Agent entry point ─────────────────────────────────────────────────────────
export {
  initializeFilesystemAgent,
  shutdownFilesystemAgent,
  runFilesystemAgent,
  getFilesystemAgentDiagnostics,
  type FilesystemAgentInput,
} from './filesystem-agent.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  FilesystemOperationKind,
  FilesystemOperationStatus,
  FilesystemSessionStatus,
  FilesystemOperationRequest,
  FilesystemOperationResult,
  FilesystemAgentResult,
  FilesystemExecutionContext,
  FilesystemOperation,
  FilesystemSession,
  FilesystemRetryConfig,
  FilesystemFailureRecord,
  ReadOperationRequest,
  ReadOperationResult,
  WriteOperationRequest,
  WriteOperationResult,
  PatchOperationRequest,
  PatchOperationResult,
  PatchHunk,
  DeleteOperationRequest,
  DeleteOperationResult,
  SearchOperationRequest,
  SearchOperationResult,
  SearchKind,
  SearchMatch,
} from './types/filesystem.types.ts';

// ── Loop options (re-exported for callers that configure the loop) ─────────────
export type { FilesystemLoopOptions } from './execution/filesystem-loop.ts';

// ── Diagnostics ───────────────────────────────────────────────────────────────
export { filesystemMetrics }  from './telemetry/filesystem-metrics.ts';
export { filesystemLogger }   from './telemetry/filesystem-logger.ts';
export { failureMonitor }     from './monitoring/failure-monitor.ts';

// ── Context builder (for callers that manage context themselves) ───────────────
export { buildContext, toToolContext, type FilesystemContextInput } from './core/filesystem-context.ts';

// ── Retry config ──────────────────────────────────────────────────────────────
export { DEFAULT_RETRY_CONFIG, isRetryable } from './execution/retry-manager.ts';
