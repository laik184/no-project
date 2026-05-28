/**
 * server/orchestration/orchestrator.ts
 *
 * Top-level orchestrator — primary entry point for the orchestration layer.
 * Wires together: validation → context → session → state → loop → result.
 *
 * Strictly orchestration-only. No tool execution, no filesystem access,
 * no direct shell or API calls. All work flows through orchestration-loop.ts
 * → workflow-runner.ts → phase-runner.ts → dispatcher-client.ts.
 */

import type { OrchestrationRequest, OrchestrationResult } from './types/orchestration.types.ts';
import { validateRequest, validateContext } from './validation/orchestration-validator.ts';
import { buildOrchestrationContext }       from './core/orchestration-context.ts';
import { createSession, failSession }      from './core/orchestration-session.ts';
import { initState, destroyState }         from './core/orchestration-state.ts';
import { runOrchestrationLoop }            from './execution/orchestration-loop.ts';
import { getRunMetrics, globalSummary, clearRunMetrics } from './telemetry/orchestration-metrics.ts';
import { summarize as getFailureSummary }  from './monitoring/failure-monitor.ts';
import { allSnapshots, getStuckOrchestrations } from './monitoring/orchestration-monitor.ts';
import { getEscalations }                  from './lifecycle/escalation-manager.ts';
import { toErrorMessage, newOrchestrationId } from './utils/orchestration-utils.ts';

// ── Initialization state ──────────────────────────────────────────────────────

let _initialized = false;

export function initOrchestrator(): void {
  if (_initialized) return;
  _initialized = true;
  console.log('[orchestrator] Initialized — orchestration layer ready.');
}

export function shutdownOrchestrator(): void {
  _initialized = false;
  console.log('[orchestrator] Shutdown complete.');
}

// ── Primary entry point ───────────────────────────────────────────────────────

export async function orchestrate(
  req: OrchestrationRequest,
): Promise<OrchestrationResult> {
  // ── Ensure orchestrationId is always set ──────────────────────────────────
  const fullReq: OrchestrationRequest = req.orchestrationId
    ? req
    : { ...req, orchestrationId: newOrchestrationId() };

  // ── Validate request ──────────────────────────────────────────────────────
  const reqValidation = validateRequest(fullReq);
  if (!reqValidation.valid) {
    return {
      ok:                 false,
      orchestrationId:    fullReq.orchestrationId ?? 'unknown',
      runId:              fullReq.runId,
      sessionId:          'none',
      workflowsTotal:     0,
      workflowsCompleted: 0,
      workflowsFailed:    0,
      durationMs:         0,
      results:            [],
      error:              `Invalid request: ${reqValidation.errors.join('; ')}`,
    };
  }

  // ── Build context ─────────────────────────────────────────────────────────
  const ctx = buildOrchestrationContext(fullReq);

  const ctxValidation = validateContext(ctx);
  if (!ctxValidation.valid) {
    return {
      ok:                 false,
      orchestrationId:    ctx.orchestrationId,
      runId:              ctx.runId,
      sessionId:          ctx.sessionId,
      workflowsTotal:     0,
      workflowsCompleted: 0,
      workflowsFailed:    0,
      durationMs:         0,
      results:            [],
      error:              `Invalid context: ${ctxValidation.errors.join('; ')}`,
    };
  }

  // ── Initialize state ──────────────────────────────────────────────────────
  initState(ctx.orchestrationId, ctx.runId);
  const session = createSession(ctx.orchestrationId, ctx.runId, ctx.projectId, 0);

  // ── Run orchestration loop ────────────────────────────────────────────────
  try {
    return await runOrchestrationLoop(fullReq, ctx, session.sessionId);
  } catch (err) {
    const error = toErrorMessage(err);
    failSession(session.sessionId);
    destroyState(ctx.orchestrationId);

    return {
      ok:                 false,
      orchestrationId:    ctx.orchestrationId,
      runId:              ctx.runId,
      sessionId:          session.sessionId,
      workflowsTotal:     0,
      workflowsCompleted: 0,
      workflowsFailed:    0,
      durationMs:         0,
      results:            [],
      error,
    };
  }
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function getOrchestratorDiagnostics(runId: string): {
  metrics:        ReturnType<typeof getRunMetrics>;
  globalMetrics:  ReturnType<typeof globalSummary>;
  failureSummary: ReturnType<typeof getFailureSummary>;
  escalations:    ReturnType<typeof getEscalations>;
  activeSnapshots: ReturnType<typeof allSnapshots>;
  stuckLoops:      ReturnType<typeof getStuckOrchestrations>;
} {
  return {
    metrics:         getRunMetrics(runId),
    globalMetrics:   globalSummary(),
    failureSummary:  getFailureSummary(runId),
    escalations:     getEscalations(runId),
    activeSnapshots: allSnapshots(),
    stuckLoops:      getStuckOrchestrations(),
  };
}

export function cleanupOrchestrationRun(runId: string): void {
  clearRunMetrics(runId);
}
