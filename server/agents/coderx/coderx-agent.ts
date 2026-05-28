/**
 * server/agents/coderx/coderx-agent.ts
 *
 * CoderX Agent — top-level orchestrator.
 * Wires together the full coding lifecycle:
 *   request → context → session → coding-loop → result
 *
 * Strictly orchestration-only. No tool execution, no filesystem access,
 * no direct shell or API calls. All work flows through coding-loop.ts
 * → task-executor.ts → step-runner.ts → dispatcher-client.ts.
 */

import type {
  CoderXAgentInput,
  CoderXAgentResult,
  CoderXLoopOptions,
} from './types/coderx.types.ts';
import { buildCoderXContext }      from './core/coderx-context.ts';
import { createSession, failSession } from './core/coderx-session.ts';
import { resetState }              from './core/coderx-state.ts';
import { workingMemory }           from './memory/working-memory.ts';
import { executionHistory }        from './memory/execution-history.ts';
import { failureMonitor }          from './monitoring/failure-monitor.ts';
import { coderxLogger }            from './telemetry/coderx-logger.ts';
import { coderxMetrics }           from './telemetry/coderx-metrics.ts';
import { runCodingLoop }           from './execution/coding-loop.ts';
import { executionMonitor }        from './monitoring/execution-monitor.ts';
import { toErrorMessage }          from './utils/coding-utils.ts';

// ── Default loop options ──────────────────────────────────────────────────────

const DEFAULT_OPTIONS: CoderXLoopOptions = {
  stopOnFailure: false,
  retry: {
    maxAttempts: 3,
    delayMs:     500,
    backoff:     'exponential',
  },
};

// ── Agent lifecycle state ─────────────────────────────────────────────────────

let _initialized = false;

export function initializeCoderX(): void {
  if (_initialized) return;
  _initialized = true;
  console.log('[coderx-agent] Initialized — orchestration layer ready.');
}

export function shutdownCoderX(): void {
  _initialized = false;
  resetState();
  console.log('[coderx-agent] Shutdown complete.');
}

// ── Primary agent entry point ─────────────────────────────────────────────────

export async function runCoderXAgent(input: CoderXAgentInput): Promise<CoderXAgentResult> {
  const { request } = input;
  const opts: CoderXLoopOptions = { ...DEFAULT_OPTIONS, ...request.options };

  // ── Build context ──────────────────────────────────────────────────────────
  const context = buildCoderXContext({
    runId:       request.runId,
    projectId:   request.projectId,
    sandboxRoot: request.sandboxRoot,
    requestId:   request.requestId,
  });

  // ── Create session ─────────────────────────────────────────────────────────
  const session = createSession(
    context.runId,
    context.projectId,
    context.requestId,
    0, // total tasks are computed during planning inside coding-loop
  );

  // ── Initialize per-run stores ──────────────────────────────────────────────
  workingMemory.init(context.runId);
  coderxLogger.agentStarted(context.runId, context.requestId);

  // ── Run coding loop ────────────────────────────────────────────────────────
  try {
    const result = await runCodingLoop(request, context, session.sessionId, opts);

    if (result.ok) {
      coderxLogger.agentCompleted(context.runId, result.durationMs, result.tasksCompleted);
    } else {
      coderxLogger.agentFailed(context.runId, result.error ?? 'unknown error');
    }

    return result;

  } catch (err) {
    const error = toErrorMessage(err);
    coderxLogger.agentFailed(context.runId, error);
    failSession(session.sessionId);

    return {
      ok:             false,
      runId:          context.runId,
      sessionId:      session.sessionId,
      requestId:      context.requestId,
      tasksTotal:     0,
      tasksCompleted: 0,
      tasksFailed:    0,
      durationMs:     0,
      outputs:        [],
      error,
    };
  }
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function getCoderXDiagnostics(runId: string): {
  metrics:        ReturnType<typeof coderxMetrics.getRunMetrics>;
  globalMetrics:  ReturnType<typeof coderxMetrics.globalSummary>;
  failureSummary: ReturnType<typeof failureMonitor.summarize>;
  snapshot:       ReturnType<typeof executionMonitor.snapshot> | null;
  snapshots:      ReturnType<typeof executionHistory.getSnapshots>;
} {
  const sessionId = workingMemory.get(runId)?.plan?.planId ?? '';

  return {
    metrics:        coderxMetrics.getRunMetrics(runId),
    globalMetrics:  coderxMetrics.globalSummary(),
    failureSummary: failureMonitor.summarize(runId),
    snapshot:       sessionId
      ? executionMonitor.snapshot(sessionId, runId)
      : null,
    snapshots:      executionHistory.getSnapshots(runId),
  };
}
