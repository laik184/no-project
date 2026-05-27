import type { OrchestrationContext, PhaseResult } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { emitPhaseStarted, emitMetric } from '../events/orchestration-events.ts';
import { timed, withTimeout } from '../utils/execution-utils.ts';
import type { AnalysisResult } from './analyze-phase.ts';
import {
  createExecutionPlan,
  initializePlanner,
} from '../../agents/planner/planner-agent.ts';
import type { ExecutionPlan as RichExecutionPlan } from '../../agents/planner/types/planner.types.ts';

// ── Legacy-compatible types (execution-phase.ts imports these) ─────────────
export interface PlanTask {
  id:         string;
  type:       string;   // mapped from planner task.category
  description:string;   // mapped from planner task.title + task.description
  dependsOn:  string[]; // mapped from planner task.dependencies
  priority:   'high' | 'normal' | 'low';
}

export interface ExecutionPlan {
  planId:              string;
  runId:               string;
  phases:              string[];
  tasks:               PlanTask[];
  estimatedDurationMs: number;
  createdAt:           Date;
  richPlan?:           RichExecutionPlan; // full planner output for downstream use
}

// ── Adapter: rich planner output → legacy-compatible shape ────────────────
function mapPriority(p: string): 'high' | 'normal' | 'low' {
  if (p === 'critical' || p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
}

function adaptPlannerOutput(rich: RichExecutionPlan): ExecutionPlan {
  const tasks: PlanTask[] = rich.tasks.map((t) => ({
    id:          t.id,
    type:        t.category,
    description: `${t.title}: ${t.description}`,
    dependsOn:   t.dependencies,
    priority:    mapPriority(t.priority),
  }));

  return {
    planId:              rich.planId,
    runId:               rich.runId,
    phases:              rich.phases.map((p) => p.type),
    tasks,
    estimatedDurationMs: tasks.length * 8_000,
    createdAt:           rich.createdAt,
    richPlan:            rich,
  };
}

// ── Phase runner ───────────────────────────────────────────────────────────
export async function runPlanningPhase(
  ctx: OrchestrationContext,
  _analysis: AnalysisResult,
): Promise<PhaseResult> {
  emitPhaseStarted(ctx.runId, 'planning');
  runLogger.log(ctx.runId, 'info', '[planning-phase] Delegating to Planner Agent');

  initializePlanner();

  const { result: plan, durationMs } = await timed(() =>
    withTimeout(async () => {
      const result = await createExecutionPlan({
        runId:     ctx.runId,
        projectId: ctx.projectId,
        goal:      ctx.goal,
        timeoutMs: Math.min(ctx.timeoutMs, 55_000),
        metadata:  ctx.metadata,
      });

      if (!result.ok || !result.plan) {
        throw new Error(result.error ?? 'Planner agent returned no plan');
      }

      return adaptPlannerOutput(result.plan);
    }, { timeoutMs: 60_000 }),
  );

  emitMetric(ctx.runId, 'planning.task_count',  plan.tasks.length,  'count');
  emitMetric(ctx.runId, 'planning.phase_count',  plan.phases.length, 'count');

  runLogger.log(
    ctx.runId,
    'info',
    `[planning-phase] Plan ready — ${plan.tasks.length} tasks across ${plan.phases.length} phases`,
    {
      planId:     plan.planId,
      appType:    plan.richPlan?.appType,
      complexity: plan.richPlan?.complexity,
      valid:      plan.richPlan?.validationResults.valid,
    },
  );

  return {
    phase:    'planning',
    success:  true,
    durationMs,
    output:   plan as unknown as Record<string, unknown>,
  };
}
