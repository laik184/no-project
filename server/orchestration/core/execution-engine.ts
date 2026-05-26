import type { OrchestrationContext, PhaseResult, OrchestrationPhase } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { emitPhaseStarted, emitMetric } from '../events/orchestration-events.ts';
import { withTimeout, timed } from '../utils/execution-utils.ts';
import { runManager } from './run-manager.ts';
import { metricsCollector } from '../telemetry/metrics.ts';

export interface EngineTask {
  phase: OrchestrationPhase;
  run: (ctx: OrchestrationContext) => Promise<PhaseResult>;
  timeoutMs?: number;
  skipOnFailure?: boolean;
}

export interface EngineResult {
  runId: string;
  phases: PhaseResult[];
  success: boolean;
  totalDurationMs: number;
  failedPhase?: OrchestrationPhase;
}

export class ExecutionEngine {
  private tasks: EngineTask[] = [];

  register(task: EngineTask): this {
    this.tasks.push(task);
    return this;
  }

  clear(): void {
    this.tasks = [];
  }

  async execute(ctx: OrchestrationContext): Promise<EngineResult> {
    const results: PhaseResult[] = [];
    const globalStart = Date.now();
    let failedPhase: OrchestrationPhase | undefined;
    let aborted = false;

    runLogger.log(ctx.runId, 'info', `[execution-engine] Starting pipeline — ${this.tasks.length} phases`);
    metricsCollector.increment(ctx.runId, 'engine.pipeline.started');

    for (const task of this.tasks) {
      if (aborted && !task.skipOnFailure) {
        runLogger.log(ctx.runId, 'warn', `[execution-engine] Skipping phase "${task.phase}" — prior failure`);
        continue;
      }

      runManager.setPhase(ctx.runId, task.phase);
      emitPhaseStarted(ctx.runId, task.phase);

      const timeout = task.timeoutMs ?? ctx.timeoutMs;
      const { result: phaseResult, durationMs } = await timed(() =>
        withTimeout(() => task.run(ctx), { timeoutMs: timeout }).catch((err): PhaseResult => ({
          phase: task.phase,
          success: false,
          durationMs: 0,
          output: {},
          error: err instanceof Error ? err.message : String(err),
        }))
      );

      const enriched: PhaseResult = { ...phaseResult, durationMs };
      results.push(enriched);

      emitMetric(ctx.runId, `phase.${task.phase}.duration`, durationMs);
      metricsCollector.timing(ctx.runId, `phase.${task.phase}`, durationMs);

      if (!enriched.success) {
        runLogger.log(ctx.runId, 'error', `[execution-engine] Phase "${task.phase}" failed: ${enriched.error}`);
        failedPhase = task.phase;
        aborted = true;
      } else {
        runLogger.log(ctx.runId, 'info', `[execution-engine] Phase "${task.phase}" passed (${durationMs}ms)`);
      }
    }

    const totalDurationMs = Date.now() - globalStart;
    const success = !failedPhase;

    runLogger.log(ctx.runId, success ? 'info' : 'warn',
      `[execution-engine] Pipeline ${success ? 'completed' : 'failed'} in ${totalDurationMs}ms`);

    return { runId: ctx.runId, phases: results, success, totalDurationMs, failedPhase };
  }

  getRegisteredPhases(): OrchestrationPhase[] {
    return this.tasks.map((t) => t.phase);
  }

  taskCount(): number {
    return this.tasks.length;
  }
}

export function createDefaultEngine(): ExecutionEngine {
  return new ExecutionEngine();
}
