/**
 * server/agents/filesystem/filesystem-agent.ts
 *
 * Public entry point for the filesystem agent.
 *
 * Responsibilities (orchestration only):
 *   - validate agent input
 *   - build execution context
 *   - manage session lifecycle
 *   - delegate to the filesystem loop
 *   - return aggregated results
 *
 * NO filesystem I/O.  NO tool implementations.
 * ALL execution flows through: loop → step-runner → routing → dispatcher-client → dispatcher.
 */

import type {
  FilesystemOperationRequest,
  FilesystemAgentResult,
} from './types/filesystem.types.ts';
import type { FilesystemLoopOptions } from './execution/filesystem-loop.ts';
import { buildContext, type FilesystemContextInput } from './core/filesystem-context.ts';
import { buildMemoryContext }                        from '../../memory/context/memory-context-builder.ts';
import { memoryEngine }                              from '../../memory/core/memory-engine.ts';
import {
  createSession,
  startSession,
  completeSession,
  failSession,
  removeSession,
  listActiveSessions,
} from './core/filesystem-session.ts';
import { resetState }           from './core/filesystem-state.ts';
import { runFilesystemLoop }    from './execution/filesystem-loop.ts';
import { assertContext }        from './validation/operation-validator.ts';
import { filesystemLogger }     from './telemetry/filesystem-logger.ts';
import { filesystemMetrics }    from './telemetry/filesystem-metrics.ts';
import { failureMonitor }       from './monitoring/failure-monitor.ts';
import { elapsedMs, toErrorMessage } from './utils/filesystem-utils.ts';

// ── Agent input ───────────────────────────────────────────────────────────────

export interface FilesystemAgentInput {
  context:    FilesystemContextInput;
  operations: FilesystemOperationRequest[];
  options?:   FilesystemLoopOptions;
}

// ── Initialization guard ──────────────────────────────────────────────────────

let _initialized = false;

export function initializeFilesystemAgent(): void {
  if (_initialized) return;
  _initialized = true;
  console.log('[filesystem-agent] Initialized — orchestration layer ready');
}

export function shutdownFilesystemAgent(): void {
  const active = listActiveSessions();
  if (active.length > 0) {
    console.warn(`[filesystem-agent] Shutting down with ${active.length} active session(s)`);
  }
  _initialized = false;
  console.log('[filesystem-agent] Shutdown complete');
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Execute a filesystem agent run.
 *
 * Builds context → creates session → runs the operation loop →
 * tears down session → returns aggregated FilesystemAgentResult.
 *
 * Never throws — errors are captured in the result envelope.
 */
export async function runFilesystemAgent(
  input: FilesystemAgentInput,
): Promise<FilesystemAgentResult> {
  if (!_initialized) initializeFilesystemAgent();

  const startedAt = new Date();

  // ── Build and validate context ────────────────────────────────────────────
  let context;
  try {
    context = buildContext(input.context);
    assertContext(context);
  } catch (err) {
    const error = toErrorMessage(err);
    filesystemLogger.error(input.context.runId ?? 'unknown', `Context error: ${error}`);
    return failResult('unknown', 'unknown', 0, error, elapsedMs(startedAt));
  }

  const { runId } = context;

  // ── Validate operations list ──────────────────────────────────────────────
  if (!Array.isArray(input.operations) || input.operations.length === 0) {
    const error = 'operations must be a non-empty array.';
    filesystemLogger.error(runId, `Validation error: ${error}`);
    return failResult(runId, context.sessionId, 0, error, elapsedMs(startedAt));
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────
  const session = createSession(runId, context.projectId, input.operations.length);
  startSession(session.sessionId);
  resetState();

  filesystemLogger.info(runId, `Agent run started`, {
    sessionId:  session.sessionId,
    operations: input.operations.length,
  });

  // ── Recall memory context before filesystem execution ────────────────────
  const memCtx = await buildMemoryContext(`filesystem ${context.projectId}`, {
    categories: ['learning', 'bug', 'execution', 'architecture'],
  });
  if (memCtx.totalFound > 0) {
    filesystemLogger.info(runId, 'Memory context loaded', { records: memCtx.totalFound, hasGraph: memCtx.hasGraphData });
  }

  try {
    const result = await runFilesystemLoop(input.operations, context, input.options ?? {});

    if (result.ok) completeSession(session.sessionId);
    else           failSession(session.sessionId);

    // Fire-and-forget: persist filesystem outcome to memory platform
    memoryEngine.store({
      category: result.ok ? 'execution' : 'bug',
      content:  JSON.stringify({ projectId: context.projectId, ok: result.ok, completed: result.operationsCompleted, failed: result.operationsFailed, durationMs: result.durationMs }),
      tags:     ['filesystem', result.ok ? 'success' : 'failure'],
      score:    result.ok ? 0.9 : 0.3,
      meta:     { runId, agentSource: 'filesystem' },
    }).catch(console.error);

    filesystemLogger.info(runId, `Agent run complete — ok=${result.ok}`, {
      sessionId:  session.sessionId,
      completed:  result.operationsCompleted,
      failed:     result.operationsFailed,
      durationMs: result.durationMs,
    });

    return result;

  } catch (err) {
    const error = toErrorMessage(err);
    failSession(session.sessionId);
    filesystemLogger.sessionFailed(runId, session.sessionId, error);

    return failResult(runId, session.sessionId, input.operations.length, error, elapsedMs(startedAt));
  } finally {
    removeSession(session.sessionId);
  }
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function getFilesystemAgentDiagnostics(): {
  activeSessions:  number;
  metrics:         ReturnType<typeof filesystemMetrics.snapshot>;
  failures:        ReturnType<typeof failureMonitor.summary>;
} {
  return {
    activeSessions: listActiveSessions().length,
    metrics:        filesystemMetrics.snapshot(),
    failures:       failureMonitor.summary(),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function failResult(
  runId:      string,
  sessionId:  string,
  total:      number,
  error:      string,
  durationMs: number,
): FilesystemAgentResult {
  return {
    ok:                  false,
    sessionId,
    runId,
    operationsTotal:     total,
    operationsCompleted: 0,
    operationsFailed:    total,
    durationMs,
    results:             [],
    error,
  };
}
