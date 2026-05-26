import type { OrchestrationContext } from '../events/event-types.ts';
import { stateManager } from './state-manager.ts';
import { lifecycleManager, LifecycleState } from './lifecycle-manager.ts';
import { ExecutionEngine } from './execution-engine.ts';
import { runAnalyzePhase } from '../pipeline/analyze-phase.ts';
import { runPlanningPhase } from '../pipeline/planning-phase.ts';
import { runExecutionPhase } from '../pipeline/execution-phase.ts';
import { runVerificationPhase } from '../pipeline/verification-phase.ts';
import { failureHandler } from '../retry/failure-handler.ts';
import { performanceMonitor } from '../telemetry/performance-monitor.ts';
import { registerEventHandlers, unregisterEventHandlers } from '../events/event-handlers.ts';
import { emitRunStarted, emitRunCompleted, emitRunFailed } from '../events/orchestration-events.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { generateRunId, elapsed } from '../utils/orchestration-helpers.ts';
import { validateStartRun } from '../utils/validators.ts';

export interface StartRunInput {
  projectId: string;
  goal: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface OrchestratorResult {
  runId: string;
  success: boolean;
  durationMs: number;
  failedPhase?: string;
  error?: string;
}

export class Orchestrator {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    registerEventHandlers();
    performanceMonitor.start();
    this.initialized = true;
    console.log('[orchestrator] Initialized');
  }

  shutdown(): void {
    unregisterEventHandlers();
    performanceMonitor.stop();
    this.initialized = false;
    console.log('[orchestrator] Shut down');
  }

  async startRun(input: StartRunInput): Promise<OrchestratorResult> {
    const validated = validateStartRun(input);
    const runId = generateRunId();

    const ctx: OrchestrationContext = {
      runId,
      projectId: validated.projectId,
      goal: validated.goal,
      startedAt: new Date(),
      timeoutMs: validated.timeoutMs,
      metadata: validated.metadata,
    };

    stateManager.init(runId);
    lifecycleManager.register(runId);
    performanceMonitor.trackRunStart();

    runLogger.log(runId, 'info', `[orchestrator] Run started for project "${ctx.projectId}"`);

    try {
      stateManager.transition(runId, 'running');
      lifecycleManager.transition(runId, LifecycleState.Starting);
      lifecycleManager.transition(runId, LifecycleState.Running);
      emitRunStarted(runId);

      const result = await this.executePipeline(ctx);

      if (result.success) {
        stateManager.transition(runId, 'completed');
        lifecycleManager.transition(runId, LifecycleState.Completing);
        lifecycleManager.transition(runId, LifecycleState.Completed);
        emitRunCompleted(runId, elapsed(ctx.startedAt));
      } else {
        stateManager.transition(runId, 'failed');
        lifecycleManager.transition(runId, LifecycleState.Failed);
        emitRunFailed(runId, (result.failedPhase as any) ?? 'execution', result.error ?? 'Unknown failure');
      }

      return {
        runId,
        success: result.success,
        durationMs: elapsed(ctx.startedAt),
        failedPhase: result.failedPhase,
        error: result.error,
      };
    } catch (err) {
      const failure = failureHandler.classify(runId, stateManager.get(runId)?.phase ?? 'execution', err);
      stateManager.setError(runId, failure.message);
      stateManager.transition(runId, 'failed');
      lifecycleManager.transition(runId, LifecycleState.Failed);
      emitRunFailed(runId, stateManager.get(runId)?.phase ?? 'execution', failure.message, failure.recoverable);

      return { runId, success: false, durationMs: elapsed(ctx.startedAt), error: failure.message };
    } finally {
      performanceMonitor.trackRunEnd();
    }
  }

  private async executePipeline(ctx: OrchestrationContext): Promise<{ success: boolean; failedPhase?: string; error?: string }> {
    const engine = new ExecutionEngine();

    engine.register({
      phase: 'analyze',
      timeoutMs: 15_000,
      run: (c) => runAnalyzePhase(c),
    });

    engine.register({
      phase: 'planning',
      timeoutMs: 30_000,
      run: async (c) => {
        const analyzeResult = stateManager.get(c.runId);
        const fakeAnalysis = { complexityScore: 50, executionMode: 'standard' as const, estimatedTaskCount: 5, requiresBrowser: true, requiresVerification: true, tags: [] };
        return runPlanningPhase(c, fakeAnalysis);
      },
    });

    engine.register({
      phase: 'execution',
      timeoutMs: ctx.timeoutMs,
      run: async (c) => {
        const fakePlan = { planId: `plan_${c.runId}`, runId: c.runId, phases: [], tasks: [
          { id: `${c.runId}_t1`, type: 'implement', description: c.goal, dependsOn: [], priority: 'high' as const },
        ], estimatedDurationMs: 10_000, createdAt: new Date() };
        return runExecutionPhase(c, fakePlan);
      },
    });

    engine.register({
      phase: 'verification',
      timeoutMs: 90_000,
      run: (c) => runVerificationPhase(c, `.sandbox/${c.projectId}`),
    });

    const result = await engine.execute(ctx);
    return {
      success: result.success,
      failedPhase: result.failedPhase,
      error: result.phases.find((p) => !p.success)?.error,
    };
  }

  getActiveRuns(): string[] {
    return lifecycleManager.getActiveRuns();
  }

  getRunStatus(runId: string) {
    return {
      lifecycle: lifecycleManager.get(runId),
      state: stateManager.get(runId),
    };
  }
}

export const orchestrator = new Orchestrator();
