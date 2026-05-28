/**
 * server/agents/filesystem/execution/filesystem-loop.ts
 *
 * Main filesystem runtime loop.
 * Controls operation lifecycle, sequencing, retries, and result aggregation.
 * No filesystem I/O — orchestration only via step-runner and state management.
 */

import type {
  FilesystemOperationRequest,
  FilesystemOperationResult,
  FilesystemAgentResult,
  FilesystemExecutionContext,
} from '../types/filesystem.types.ts';
import type { FilesystemRetryConfig } from '../types/filesystem.types.ts';
import { registerOperation, listCompleted, listFailed } from '../core/filesystem-state.ts';
import { incrementDone }      from '../core/filesystem-session.ts';
import { runStep }            from './step-runner.ts';
import { DEFAULT_RETRY_CONFIG } from './retry-manager.ts';
import { filesystemLogger }   from '../telemetry/filesystem-logger.ts';
import { elapsedMs }          from '../utils/filesystem-utils.ts';

// ── Loop options ──────────────────────────────────────────────────────────────

export interface FilesystemLoopOptions {
  retry?:         FilesystemRetryConfig;
  stopOnFailure?: boolean;
}

// ── Main loop ─────────────────────────────────────────────────────────────────

/**
 * Run the filesystem operation loop.
 * Processes each operation sequentially, collecting results.
 * Returns an aggregated agent result — never throws.
 */
export async function runFilesystemLoop(
  requests:  FilesystemOperationRequest[],
  context:   FilesystemExecutionContext,
  options:   FilesystemLoopOptions = {},
): Promise<FilesystemAgentResult> {
  const { retry = DEFAULT_RETRY_CONFIG, stopOnFailure = false } = options;
  const startedAt = new Date();

  filesystemLogger.sessionStarted(context.runId, context.sessionId, requests.length);

  // ── Register all operations into state ────────────────────────────────────
  const operations = requests.map((req) => registerOperation(req));

  const results:      FilesystemOperationResult[] = [];
  let operationsCompleted = 0;
  let operationsFailed    = 0;

  // ── Sequential execution loop ─────────────────────────────────────────────
  for (const op of operations) {
    // Check abort signal
    if (context.signal?.aborted) {
      filesystemLogger.warn(
        context.runId,
        `Loop aborted by signal after ${operationsCompleted} operation(s)`,
        { sessionId: context.sessionId },
      );
      break;
    }

    const stepResult = await runStep(op, context, retry);
    incrementDone(context.sessionId);

    if (stepResult.ok && stepResult.result) {
      results.push(stepResult.result);
      operationsCompleted++;
    } else {
      operationsFailed++;
      filesystemLogger.warn(
        context.runId,
        `Operation ${op.operationId} failed — ${stopOnFailure ? 'stopping loop' : 'continuing'}`,
        { error: stepResult.error },
      );
      if (stopOnFailure) break;
    }
  }

  const durationMs = elapsedMs(startedAt);
  const ok         = operationsFailed === 0;

  filesystemLogger.sessionCompleted(
    context.runId,
    context.sessionId,
    operationsCompleted,
    operationsFailed,
    durationMs,
  );

  return {
    ok,
    sessionId:           context.sessionId,
    runId:               context.runId,
    operationsTotal:     requests.length,
    operationsCompleted,
    operationsFailed,
    durationMs,
    results,
    error: ok ? undefined : `${operationsFailed} operation(s) failed`,
  };
}
