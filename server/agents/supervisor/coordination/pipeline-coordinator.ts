import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode } from '../types/supervisor.types.ts';
import { executionModeDetector } from '../analysis/execution-mode-detector.ts';
import { timeoutMonitor } from '../monitoring/timeout-monitor.ts';
import { loopDetector } from '../monitoring/loop-detector.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import { emitPhaseStarted } from '../../../orchestration/events/orchestration-events.ts';

export interface PipelinePlan {
  phases: OrchestrationPhase[];
  mode: ExecutionMode;
  totalTimeoutMs: number;
}

export interface PhaseOutcome {
  phase: OrchestrationPhase;
  success: boolean;
  durationMs: number;
  skipped: boolean;
  error?: string;
}

export const pipelineCoordinator = {
  buildPlan(mode: ExecutionMode): PipelinePlan {
    const phases = executionModeDetector.phasesForMode(mode);
    const totalTimeoutMs = phases.reduce(
      (sum, p) => sum + (mode === 'complex' ? 200_000 : mode === 'standard' ? 120_000 : 60_000),
      0,
    );
    return { phases, mode, totalTimeoutMs };
  },

  startPhase(runId: string, phase: OrchestrationPhase, mode: ExecutionMode, timeoutMs?: number): void {
    supervisorLogger.info(runId, `[pipeline-coordinator] Starting phase "${phase}"`);
    timeoutMonitor.startPhase(runId, phase, mode, timeoutMs);
    loopDetector.record(runId, phase, true); // record as active
    emitPhaseStarted(runId, phase);
  },

  endPhase(runId: string, phase: OrchestrationPhase, success: boolean): void {
    timeoutMonitor.endPhase(runId, phase);
    loopDetector.record(runId, phase, success);
    supervisorLogger.info(runId, `[pipeline-coordinator] Phase "${phase}" ${success ? 'passed' : 'failed'}`);
  },

  shouldSkipPhase(runId: string, phase: OrchestrationPhase, aborted: boolean): boolean {
    if (!aborted) return false;
    const optionalPhases: OrchestrationPhase[] = ['browser'];
    return !optionalPhases.includes(phase);
  },

  isPhaseTimedOut(runId: string, phase: OrchestrationPhase): boolean {
    return timeoutMonitor.isTimedOut(runId, phase);
  },

  remainingPhaseTimeMs(runId: string, phase: OrchestrationPhase): number {
    return timeoutMonitor.remainingMs(runId, phase);
  },

  summarize(outcomes: PhaseOutcome[]): { success: boolean; failedPhase?: OrchestrationPhase } {
    const failed = outcomes.find((o) => !o.success && !o.skipped);
    return { success: !failed, failedPhase: failed?.phase };
  },
};
