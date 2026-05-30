/**
 * server/agents/supervisor/supervisor-agent.ts
 *
 * ENTRY POINT for the supervisor agent orchestration layer.
 *
 * Responsibilities:
 *   - validate incoming supervision requests
 *   - build supervision context
 *   - open/close session lifecycle
 *   - delegate to supervision-loop
 *   - return structured results
 *
 * Architecture: orchestration ONLY.
 * No child_process. No spawn. No exec. No shell. No direct tool execution.
 */

import type { SupervisionRequest, SupervisionResult } from './types/supervisor.types.ts';
import { buildSupervisionContext }                    from './core/supervisor-context.ts';
import { supervisorSession }                          from './core/supervisor-session.ts';
import { runSupervisionLoop }                         from './execution/supervision-loop.ts';
import { validateSupervisionRequest, validateRuntimeContext } from './validation/supervision-validator.ts';
import { supervisorLogger }                           from './telemetry/supervisor-logger.ts';
import { makeRunId }                                  from './utils/supervision-utils.ts';
import { memoryEngine, buildMemoryContext }            from '../../memory/index.ts';

// ── Agent lifecycle ───────────────────────────────────────────────────────────

let _initialised = false;

export function initSupervisorAgent(): void {
  if (_initialised) return;
  _initialised = true;
  console.log('[supervisor-agent] Initialized — event handlers registered');
}

/** Alias used by the orchestration layer. */
export const initializeSupervisor = initSupervisorAgent;

export function shutdownSupervisorAgent(): void {
  _initialised = false;
  console.log('[supervisor-agent] Shut down');
}

// ── Orchestration-layer cycle API ─────────────────────────────────────────────

export interface SupervisorCycleResult {
  success:      boolean;
  failedPhase?: string;
  error?:       string;
}

/**
 * High-level cycle entry point called by the Orchestrator.
 * Drives a full supervision pass over an OrchestrationContext with no
 * pre-built task list — tasks are empty and the supervisor completes
 * immediately (the executor/planner pipeline handles the work).
 */
export async function runSupervisorCycle(
  ctx: { runId: string; projectId: string; goal: string; metadata?: Record<string, unknown> },
): Promise<SupervisorCycleResult> {
  try {
    const result = await supervise({
      runId:       ctx.runId,
      projectId:   ctx.projectId,
      sandboxRoot: process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
      goal:        ctx.goal,
      tasks:       [],
      meta:        ctx.metadata ?? {},
    });
    return {
      success:     result.success,
      error:       result.errors[0],
      failedPhase: result.success ? undefined : 'supervision',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, failedPhase: 'supervision', error: message };
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function supervise(
  req: SupervisionRequest,
): Promise<SupervisionResult> {
  const runId = req.runId ?? makeRunId();
  const { projectId, sandboxRoot, goal, tasks, signal, meta = {} } = req;

  supervisorLogger.info(runId, 'Supervision session requested', {
    projectId, goal, taskCount: tasks.length,
  });

  // ── 1. Validate request ───────────────────────────────────────────────────
  const requestValidation = validateSupervisionRequest(req);
  if (!requestValidation.valid) {
    supervisorLogger.error(runId, 'Request validation failed', {
      errors: requestValidation.errors,
    });
    return failed(runId, 0, requestValidation.errors);
  }
  if (requestValidation.warnings.length > 0) {
    supervisorLogger.warn(runId, 'Request validation warnings', {
      warnings: requestValidation.warnings,
    });
  }

  // ── 2. Validate runtime context ───────────────────────────────────────────
  const contextValidation = validateRuntimeContext(runId, projectId, sandboxRoot);
  if (!contextValidation.valid) {
    supervisorLogger.error(runId, 'Context validation failed', {
      errors: contextValidation.errors,
    });
    return failed(runId, 0, contextValidation.errors);
  }

  // ── 3. Open session ───────────────────────────────────────────────────────
  supervisorSession.open({ runId, projectId, sandboxRoot, goal, totalTasks: tasks.length });
  supervisorSession.transition(runId, 'validating');

  // ── 3b. Recall memory context before supervision ─────────────────────────
  const memCtx = await buildMemoryContext(goal, {
    categories: ['decision', 'architecture', 'learning', 'reflection', 'execution'],
  });
  const enrichedMeta: Record<string, unknown> = memCtx.totalFound > 0
    ? { ...meta, memoryContext: memCtx.summary, memoryGraphEntities: memCtx.graphEntities.length }
    : { ...meta };
  if (memCtx.totalFound > 0) {
    supervisorLogger.info(runId, 'Memory context loaded', { records: memCtx.totalFound, hasGraph: memCtx.hasGraphData });
  }

  // ── 4. Build context ──────────────────────────────────────────────────────
  const context = buildSupervisionContext(runId, projectId, sandboxRoot, goal, enrichedMeta, signal);

  // ── 5. Delegate to supervision loop ───────────────────────────────────────
  const startedAt = Date.now();
  supervisorSession.transition(runId, 'routing');

  const outcomes = await runSupervisionLoop(tasks, context);
  const durationMs = Date.now() - startedAt;

  const errors = outcomes
    .filter((o) => !o.success && o.error)
    .map((o) => o.error as string);

  const success = errors.length === 0 && outcomes.every((o) => o.success);

  // ── 6. Close session ──────────────────────────────────────────────────────
  supervisorSession.close(runId, success, durationMs);

  supervisorLogger.info(runId, `Supervision complete — success=${success}`, {
    durationMs, tasksRun: outcomes.length, errors: errors.length,
  });

  // Fire-and-forget: persist supervision decision to memory platform
  memoryEngine.store({
    category: 'decision',
    content:  JSON.stringify({ goal, success, tasksRun: outcomes.length, durationMs }),
    tags:     ['supervision', success ? 'success' : 'failure'],
    score:    success ? 1.0 : 0.3,
    meta:     { runId, projectId, agentSource: 'supervisor' },
  }).catch(console.error);

  return { runId, success, durationMs, tasksRun: outcomes.length, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function failed(
  runId:      string,
  durationMs: number,
  errors:     string[],
): SupervisionResult {
  return { runId, success: false, durationMs, tasksRun: 0, errors };
}
