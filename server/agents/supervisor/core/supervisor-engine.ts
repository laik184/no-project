import type { OrchestrationContext } from '../../../orchestration/events/event-types.ts';
import type { SupervisorRunResult, ExecutionMode, GoalCategory } from '../types/supervisor.types.ts';
import { supervisorState } from './supervisor-state.ts';
import { supervisorContext } from './supervisor-context.ts';
import { executionController } from './execution-controller.ts';
import { complexityAnalyzer } from '../analysis/complexity-analyzer.ts';
import { goalClassifier } from '../analysis/goal-classifier.ts';
import { executionModeDetector } from '../analysis/execution-mode-detector.ts';
import { executionMonitor } from '../monitoring/execution-monitor.ts';
import { emitSupervisorStarted, emitCycleStarted, emitCycleCompleted, emitCycleFailed } from '../events/supervisor-events.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';
import { elapsed, generateSessionId } from '../utils/supervisor-helpers.ts';
import type { PhaseExecutionResult } from './execution-controller.ts';

export class SupervisorEngine {
  async run(
    ctx: OrchestrationContext,
    phaseRunners: Partial<Record<string, () => Promise<{ success: boolean }>>>,
  ): Promise<SupervisorRunResult> {
    const sessionId = generateSessionId();
    const start = new Date();

    const complexity     = complexityAnalyzer.analyze(ctx.goal);
    const classification = goalClassifier.classify(ctx.goal);
    const { mode }       = executionModeDetector.detect(complexity, classification);
    const category       = classification.category as GoalCategory;

    supervisorState.create(sessionId, ctx.runId, ctx.projectId, ctx.goal, mode, category, ctx.metadata);
    supervisorContext.create(sessionId, ctx, mode, category, complexity, classification);
    supervisorState.transition(sessionId, 'active');
    executionMonitor.track(ctx.runId, { startedAt: start, currentPhase: null, retryCount: 0 });

    emitSupervisorStarted(sessionId, ctx.runId, ctx.projectId, mode, category);
    supervisorLogger.info(ctx.runId, `[supervisor-engine] Session ${sessionId} — mode=${mode} category=${category} complexity=${complexity.score}`);

    const phases = executionModeDetector.phasesForMode(mode);
    const results: PhaseExecutionResult[] = [];
    let retries = 0;

    for (const phase of phases) {
      supervisorState.setPhase(sessionId, phase);
      emitCycleStarted(sessionId, ctx.runId, phase, 0, retries);

      const runner = phaseRunners[phase] ?? (() => Promise.resolve({ success: true }));
      const phaseResult = await executionController.runPhase(
        { sessionId, runId: ctx.runId, mode, category, timeoutMs: ctx.timeoutMs },
        phase,
        runner,
      );

      results.push(phaseResult);

      if (!phaseResult.success && !phaseResult.skipped) {
        retries += phaseResult.decision?.action === 'retry' ? 1 : 0;
        emitCycleFailed(sessionId, ctx.runId, phase, phaseResult.durationMs, retries);
        supervisorLogger.error(ctx.runId, `[supervisor-engine] Phase "${phase}" failed — stopping pipeline`);
        break;
      }

      emitCycleCompleted(sessionId, ctx.runId, phase, phaseResult.durationMs, retries);
      supervisorMetrics.increment(ctx.runId, 'supervisor.cycles.total');
    }

    const success = executionController.decideContinue(results);
    const failedResult = results.find((r) => !r.success && !r.skipped);

    supervisorState.transition(sessionId, 'shutdown');
    executionMonitor.untrack(ctx.runId);
    supervisorMetrics.increment(ctx.runId, success ? 'supervisor.runs.succeeded' : 'supervisor.runs.failed');

    return {
      sessionId,
      runId:       ctx.runId,
      success,
      mode,
      category,
      durationMs:  elapsed(start),
      retries,
      failedPhase: failedResult?.phase,
      error:       failedResult?.error,
    };
  }
}

export const supervisorEngine = new SupervisorEngine();
