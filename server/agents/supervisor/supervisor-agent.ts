/**
 * supervisor-agent.ts
 *
 * Public entry point for the Supervisor Agent system.
 * Connects with existing orchestrator.ts.
 *
 * Responsibilities:
 * - Wrap the supervisor engine in a clean public API
 * - Register/unregister event handlers
 * - Expose initializeSupervisor / runSupervisorCycle / shutdownSupervisor
 *
 * Must NOT: generate code, execute shell commands, contain business logic.
 */

import type { OrchestrationContext } from '../../orchestration/events/event-types.ts';
import type { SupervisorRunResult } from './types/supervisor.types.ts';
import { supervisorEngine } from './core/supervisor-engine.ts';
import { registerSupervisorHandlers, unregisterSupervisorHandlers } from './events/event-handlers.ts';
import { supervisorLogger } from './telemetry/supervisor-logger.ts';
import { supervisorMetrics } from './telemetry/supervisor-metrics.ts';
import { runAnalyzePhase } from '../../orchestration/pipeline/analyze-phase.ts';
import { runPlanningPhase } from '../../orchestration/pipeline/planning-phase.ts';
import { runExecutionPhase } from '../../orchestration/pipeline/execution-phase.ts';
import { runVerificationPhase } from '../../orchestration/pipeline/verification-phase.ts';
import { runBrowserPhase } from '../../orchestration/pipeline/browser-phase.ts';
import { emitSupervisorShutdown } from './events/supervisor-events.ts';

let _initialized = false;

export function initializeSupervisor(): void {
  if (_initialized) return;
  registerSupervisorHandlers();
  _initialized = true;
  console.log('[supervisor-agent] Initialized — event handlers registered');
}

export async function runSupervisorCycle(ctx: OrchestrationContext): Promise<SupervisorRunResult> {
  if (!_initialized) initializeSupervisor();

  supervisorLogger.info(ctx.runId, `[supervisor-agent] Starting supervisor cycle for run ${ctx.runId}`);
  supervisorMetrics.increment(ctx.runId, 'supervisor.cycles.requested');

  const fakeAnalysis = {
    complexityScore:      50,
    executionMode:        'standard' as const,
    estimatedTaskCount:   5,
    requiresBrowser:      true,
    requiresVerification: true,
    tags:                 [] as string[],
  };

  const fakePlan = {
    planId:              `plan_${ctx.runId}`,
    runId:               ctx.runId,
    phases:              [] as string[],
    tasks:               [{
      id:          `${ctx.runId}_t1`,
      type:        'implement',
      description: ctx.goal,
      dependsOn:   [] as string[],
      priority:    'high' as const,
    }],
    estimatedDurationMs: 10_000,
    createdAt:           new Date(),
  };

  const phaseRunners: Partial<Record<string, () => Promise<{ success: boolean }>>> = {
    analyze:      () => runAnalyzePhase(ctx).then((r) => ({ success: r.success })),
    planning:     () => runPlanningPhase(ctx, fakeAnalysis).then((r) => ({ success: r.success })),
    execution:    () => runExecutionPhase(ctx, fakePlan).then((r) => ({ success: r.success })),
    verification: () => runVerificationPhase(ctx, `.sandbox/${ctx.projectId}`).then((r) => ({ success: r.success })),
    browser:      () => runBrowserPhase(ctx, `http://localhost:3001`).then((r) => ({ success: r.success })),
  };

  const result = await supervisorEngine.run(ctx, phaseRunners);

  supervisorLogger.info(
    ctx.runId,
    `[supervisor-agent] Cycle complete — success=${result.success} mode=${result.mode} duration=${result.durationMs}ms`,
  );

  return result;
}

export function shutdownSupervisor(): void {
  unregisterSupervisorHandlers();
  emitSupervisorShutdown('system', 'shutdown', 0);
  _initialized = false;
  console.log('[supervisor-agent] Shut down — event handlers unregistered');
}

export type { SupervisorRunResult };
