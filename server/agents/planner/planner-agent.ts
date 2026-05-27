import type { PlannerInput, PlannerResult } from './types/planner.types.ts';
import { runPlannerEngine } from './core/planner-engine.ts';
import {
  createSession,
  startSession,
  completeSession,
  failSession,
  removeSession,
  listActiveSessions,
} from './core/planning-session.ts';
import {
  registerPlannerEventHandlers,
  unregisterPlannerEventHandlers,
} from './events/event-handlers.ts';
import {
  emitPlanningStarted,
  emitPlanningCompleted,
  emitPlanningFailed,
} from './events/planner-events.ts';
import { safeValidatePlannerInput } from './utils/validators.ts';
import { plannerLogger } from './telemetry/planner-logger.ts';
import { elapsed } from '../../orchestration/utils/orchestration-helpers.ts';

let initialized = false;

export function initializePlanner(): void {
  if (initialized) return;
  registerPlannerEventHandlers();
  initialized = true;
  console.log('[planner-agent] Initialized — event handlers registered');
}

export async function createExecutionPlan(raw: unknown): Promise<PlannerResult> {
  if (!initialized) initializePlanner();

  const validated = safeValidatePlannerInput(raw);
  if (!validated.ok) {
    return { ok: false, error: `Invalid input: ${validated.error}`, durationMs: 0 };
  }

  const input   = validated.data;
  const session = createSession(input);
  const { runId } = input;

  plannerLogger.info(runId, 'createExecutionPlan called', { sessionId: session.sessionId });
  emitPlanningStarted(runId, input.goal);
  startSession(session.sessionId);

  const startedAt = new Date();

  try {
    const plan       = await runPlannerEngine(input);
    const durationMs = elapsed(startedAt);

    completeSession(session.sessionId, plan);
    emitPlanningCompleted(runId, plan, durationMs);

    plannerLogger.info(runId, 'Execution plan created successfully', {
      planId:    plan.planId,
      appType:   plan.appType,
      complexity:plan.complexity,
      taskCount: plan.tasks.length,
      durationMs,
    });

    removeSession(session.sessionId);
    return { ok: true, plan, durationMs };
  } catch (err) {
    const durationMs = elapsed(startedAt);
    const error      = err instanceof Error ? err.message : String(err);

    failSession(session.sessionId, error);
    emitPlanningFailed(runId, error, durationMs);

    plannerLogger.error(runId, 'Execution plan creation failed', { error, durationMs });

    removeSession(session.sessionId);
    return { ok: false, error, durationMs };
  }
}

export function shutdownPlanner(): void {
  const active = listActiveSessions();
  if (active.length > 0) {
    console.warn(`[planner-agent] Shutting down with ${active.length} active session(s)`);
  }
  unregisterPlannerEventHandlers();
  initialized = false;
  console.log('[planner-agent] Shutdown complete');
}

export type { PlannerInput, PlannerResult, ExecutionPlan } from './types/planner.types.ts';
