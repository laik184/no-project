import type { OrchestrationContext } from '../events/event-types.ts';
import { runManager } from './run-manager.ts';
import { failureHandler } from '../retry/failure-handler.ts';
import { performanceMonitor } from '../telemetry/performance-monitor.ts';
import { registerEventHandlers, unregisterEventHandlers } from '../events/event-handlers.ts';
import { emitRunStarted, emitRunCompleted, emitRunFailed } from '../events/orchestration-events.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { generateRunId, elapsed } from '../utils/orchestration-helpers.ts';
import { validateStartRun } from '../utils/validators.ts';
import { initializeSupervisor, runSupervisorCycle } from '../../agents/supervisor/supervisor-agent.ts';

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
    initializeSupervisor();
    performanceMonitor.start();
    this.initialized = true;
    console.log('[orchestrator] Initialized — supervisor wired');
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

    runManager.create(runId, validated.metadata);
    performanceMonitor.trackRunStart();
    runLogger.log(runId, 'info', `[orchestrator] Run started for project "${ctx.projectId}"`);

    try {
      runManager.transition(runId, 'running');
      emitRunStarted(runId);

      const result = await runSupervisorCycle(ctx);

      if (result.success) {
        runManager.transition(runId, 'completed');
        emitRunCompleted(runId, elapsed(ctx.startedAt));
      } else {
        runManager.transition(runId, 'failed');
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
      const failure = failureHandler.classify(runId, runManager.get(runId)?.phase ?? 'execution', err);
      runManager.setError(runId, failure.message);
      runManager.transition(runId, 'failed');
      emitRunFailed(runId, runManager.get(runId)?.phase ?? 'execution', failure.message, failure.recoverable);
      return { runId, success: false, durationMs: elapsed(ctx.startedAt), error: failure.message };
    } finally {
      performanceMonitor.trackRunEnd();
    }
  }

  getActiveRuns(): string[] {
    return runManager.getActiveRuns();
  }

  getRunStatus(runId: string) {
    return { run: runManager.get(runId) };
  }
}

export const orchestrator = new Orchestrator();
