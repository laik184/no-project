/**
 * server/agents/filesystem/execution/step-runner.ts
 *
 * Executes one filesystem operation step.
 * Coordinates validation → routing → retry → telemetry for a single operation.
 * Does NOT perform filesystem I/O — all execution is routed through the dispatcher.
 */

import type {
  FilesystemOperation,
  FilesystemOperationResult,
  FilesystemExecutionContext,
} from '../types/filesystem.types.ts';
import { routeOperation }        from '../coordination/filesystem-routing.ts';
import { withRetry, DEFAULT_RETRY_CONFIG, type FilesystemRetryConfig } from './retry-manager.ts';
import { assertOperation }       from '../validation/operation-validator.ts';
import { assertTransition }      from '../validation/integrity-validator.ts';
import { failureMonitor }        from '../monitoring/failure-monitor.ts';
import { filesystemLogger }      from '../telemetry/filesystem-logger.ts';
import { filesystemMetrics }     from '../telemetry/filesystem-metrics.ts';
import { elapsedMs }             from '../utils/filesystem-utils.ts';
import {
  markRunning,
  markRetrying,
  markCompleted,
  markFailed,
} from '../core/filesystem-state.ts';

// ── Step result ───────────────────────────────────────────────────────────────

export interface StepResult {
  ok:          boolean;
  operationId: string;
  result?:     FilesystemOperationResult;
  error?:      string;
  attempts:    number;
  durationMs:  number;
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Run one operation step end-to-end:
 *   validate → transition to running → retry loop → route → record result.
 */
export async function runStep(
  op:      FilesystemOperation,
  context: FilesystemExecutionContext,
  retry:   FilesystemRetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<StepResult> {
  const { operationId, request } = op;
  const kind                     = request.kind;
  const startedAt                = new Date();

  // Validate the request before touching state
  assertOperation(request);

  // Transition: pending → running
  assertTransition(operationId, op.status, 'running');
  markRunning(operationId);
  filesystemLogger.operationStarted(context.runId, operationId, kind, (request as { path?: string }).path ?? '');
  filesystemMetrics.recordStarted(kind);

  const retryResult = await withRetry(
    () => routeOperation(request, context),
    retry,
    (attempt, error, delayMs) => {
      // Transition: running → retrying
      markRetrying(operationId);
      filesystemLogger.operationRetrying(context.runId, operationId, kind, attempt, delayMs);
      filesystemMetrics.recordRetry(kind);
      failureMonitor.record(operationId, context.runId, kind, error, attempt);
    },
  );

  const duration = elapsedMs(startedAt);

  if (retryResult.ok && retryResult.data !== undefined) {
    markCompleted(operationId, retryResult.data);
    filesystemLogger.operationCompleted(context.runId, operationId, kind, duration);
    filesystemMetrics.recordCompleted(kind, duration);
    failureMonitor.clear(operationId);

    return {
      ok:          true,
      operationId,
      result:      retryResult.data,
      attempts:    retryResult.attempts,
      durationMs:  duration,
    };
  } else {
    const error = retryResult.error ?? 'Unknown error';
    markFailed(operationId, error);
    filesystemLogger.operationFailed(context.runId, operationId, kind, error, retryResult.attempts);
    filesystemMetrics.recordFailed(kind, duration);
    failureMonitor.record(operationId, context.runId, kind, error, retryResult.attempts);

    return {
      ok:          false,
      operationId,
      error,
      attempts:    retryResult.attempts,
      durationMs:  duration,
    };
  }
}
