import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode, SupervisorDecision } from '../types/supervisor.types.ts';
import { retryCoordinator } from '../coordination/retry-coordinator.ts';
import { pipelineCoordinator } from '../coordination/pipeline-coordinator.ts';
import { agentRouter } from '../routing/agent-router.ts';
import { taskRouter } from '../routing/task-router.ts';
import { escalationDecision } from '../decisions/escalation-decision.ts';
import { failureDecision } from '../decisions/failure-decision.ts';
import { executionMonitor } from '../monitoring/execution-monitor.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';
import type { GoalCategory } from '../types/supervisor.types.ts';

export interface PhaseExecutionResult {
  phase: OrchestrationPhase;
  success: boolean;
  durationMs: number;
  skipped: boolean;
  decision?: SupervisorDecision;
  error?: string;
}

export interface ControllerOptions {
  sessionId: string;
  runId: string;
  mode: ExecutionMode;
  category: GoalCategory;
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
    const start = Date.now();

    const routing = agentRouter.route(runId, phase, 'normal');
    taskRouter.route({ runId, phase, type: phase, mode, category });
    pipelineCoordinator.startPhase(runId, phase, mode, routing.targetPhase ? agentRouter.timeoutFor(routing.targetPhase) : undefined);

    executionMonitor.update(runId, { currentPhase: phase });
    supervisorLogger.info(runId, `[execution-controller] Running phase "${phase}" session=${sessionId}`);
    supervisorMetrics.increment(runId, `supervisor.phases.${phase}.started`);

    const result = await retryCoordinator.executeWithRetry(
      { phase, runId, taskId, mode },
      phaseRunner,
    );

    const durationMs = Date.now() - start;

    if (result.ok) {
      pipelineCoordinator.endPhase(runId, phase, true);
      supervisorMetrics.timing(runId, `supervisor.phases.${phase}`, durationMs);
      supervisorMetrics.increment(runId, `supervisor.phases.${phase}.completed`);
      return { phase, success: true, durationMs, skipped: false };
    }

    const { error } = result;
    pipelineCoordinator.endPhase(runId, phase, false);

    const health = executionMonitor.checkHealth(runId);
    const fDecision = failureDecision.decide({ phase, error, retryCount: 0, mode, durationMs });

    if (fDecision.action === 'skip') {
      supervisorLogger.warn(runId, `[execution-controller] Skipping optional phase "${phase}"`);
      return { phase, success: true, durationMs, skipped: true, decision: fDecision };
    }

    const eDecision = escalationDecision.shouldEscalate({
      phase,
      error,
      retryCount: 0,
      loopRisk: health.loopRisk,
      stuckMs: durationMs,
    });

    supervisorMetrics.increment(runId, `supervisor.phases.${phase}.failed`);
    return { phase, success: false, durationMs, skipped: false, decision: eDecision, error };
  },

  decideContinue(results: PhaseExecutionResult[]): boolean {
    return results.every((r) => r.success || r.skipped);
  },
};
