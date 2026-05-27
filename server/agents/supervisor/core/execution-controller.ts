/**
 * execution-controller.ts — Phase execution coordinator.
 *
 * Responsibilities only:
 * - Execute a phase via retryCoordinator
 * - Update monitoring state
 * - Coordinate pipeline transitions
 * - Return a typed PhaseExecutionResult
 *
 * Decision branching (escalation/failure analysis) lives in decisions/.
 */

import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode, SupervisorDecision } from '../types/supervisor.types.ts';
import { retryCoordinator } from '../coordination/retry-coordinator.ts';
import { pipelineCoordinator } from '../coordination/pipeline-coordinator.ts';
import { agentRouter } from '../routing/agent-router.ts';
import { taskDispatcher } from '../routing/task-dispatcher.ts';
import { escalationDecision } from '../decisions/escalation-decision.ts';
import { failureDecision } from '../decisions/failure-decision.ts';
import { executionMonitor } from '../monitoring/execution-monitor.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import type { GoalCategory } from '../types/supervisor.types.ts';

export interface PhaseExecutionResult {
  phase:      OrchestrationPhase;
  success:    boolean;
  durationMs: number;
  skipped:    boolean;
  decision?:  SupervisorDecision;
  error?:     string;
}

export interface ControllerOptions {
  sessionId: string;
  runId:     string;
  mode:      ExecutionMode;
  category:  GoalCategory;
  timeoutMs?: number;
}

export const executionController = {
  async runPhase(
    opts: ControllerOptions,
    phase: OrchestrationPhase,
    phaseRunner: () => Promise<{ success: boolean; output?: Record<string, unknown> }>,
  ): Promise<PhaseExecutionResult> {
    const { sessionId, runId, mode, category } = opts;
    const taskId = `${runId}:${phase}`;
    const start  = Date.now();

    const routing = agentRouter.route(runId, phase, 'normal');
    taskDispatcher.dispatch({ runId, phase, type: phase, mode, category });
    pipelineCoordinator.startPhase(
      runId, phase, mode,
      routing.targetPhase ? agentRouter.timeoutFor(routing.targetPhase) : undefined,
    );

    executionMonitor.update(runId, { currentPhase: phase });
    supervisorLogger.info(runId, `[execution-controller] Phase "${phase}" — session=${sessionId}`);

    const result = await retryCoordinator.executeWithRetry(
      { phase, runId, taskId, mode },
      phaseRunner,
    );

    const durationMs = Date.now() - start;

    if (result.ok) {
      pipelineCoordinator.endPhase(runId, phase, true);
      return { phase, success: true, durationMs, skipped: false };
    }

    const { error } = result;
    pipelineCoordinator.endPhase(runId, phase, false);

    const fDecision = failureDecision.decide({ phase, error, retryCount: 0, mode, durationMs });
    if (fDecision.action === 'skip') {
      supervisorLogger.warn(runId, `[execution-controller] Skipping optional phase "${phase}"`);
      return { phase, success: true, durationMs, skipped: true, decision: fDecision };
    }

    const health    = executionMonitor.checkHealth(runId);
    const eDecision = escalationDecision.shouldEscalate({
      phase,
      error,
      retryCount:  0,
      loopRisk:    health.loopRisk,
      stuckMs:     durationMs,
    });

    return { phase, success: false, durationMs, skipped: false, decision: eDecision, error };
  },

  decideContinue(results: PhaseExecutionResult[]): boolean {
    return results.every((r) => r.success || r.skipped);
  },
};
