import type { OrchestrationContext, PhaseResult } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { emitPhaseStarted, emitMetric } from '../events/orchestration-events.ts';
import { timed, withTimeout } from '../utils/execution-utils.ts';
import type { AnalysisResult } from './analyze-phase.ts';

export interface PlanTask {
  id: string;
  type: string;
  description: string;
  dependsOn: string[];
  priority: 'high' | 'normal' | 'low';
}

export interface ExecutionPlan {
  planId: string;
  runId: string;
  phases: string[];
  tasks: PlanTask[];
  estimatedDurationMs: number;
  createdAt: Date;
}

function buildTasksFromAnalysis(runId: string, goal: string, analysis: AnalysisResult): PlanTask[] {
  const tasks: PlanTask[] = [
    { id: `${runId}_t1`, type: 'scaffold', description: 'Create project structure and base files', dependsOn: [], priority: 'high' },
    { id: `${runId}_t2`, type: 'implement', description: `Implement core features: ${goal.slice(0, 80)}`, dependsOn: [`${runId}_t1`], priority: 'high' },
    { id: `${runId}_t3`, type: 'style', description: 'Apply styling and layout', dependsOn: [`${runId}_t2`], priority: 'normal' },
  ];

  if (analysis.requiresVerification) {
    tasks.push({ id: `${runId}_t4`, type: 'verify', description: 'TypeScript + build verification', dependsOn: [`${runId}_t2`], priority: 'high' });
  }

  if (analysis.requiresBrowser) {
    tasks.push({ id: `${runId}_t5`, type: 'browser', description: 'Browser UI verification', dependsOn: [`${runId}_t3`], priority: 'normal' });
  }

  if (analysis.tags.includes('database') || analysis.tags.includes('crud')) {
    tasks.splice(1, 0, { id: `${runId}_t_db`, type: 'schema', description: 'Define database schema', dependsOn: [`${runId}_t1`], priority: 'high' });
  }

  return tasks;
}

function validatePlan(plan: ExecutionPlan): boolean {
  if (!plan.tasks.length) return false;
  const ids = new Set(plan.tasks.map((t) => t.id));
  return plan.tasks.every((t) => t.dependsOn.every((dep) => ids.has(dep)));
}

export async function runPlanningPhase(ctx: OrchestrationContext, analysis: AnalysisResult): Promise<PhaseResult> {
  emitPhaseStarted(ctx.runId, 'planning');
  runLogger.log(ctx.runId, 'info', '[planning-phase] Building execution plan');

  const { result: plan, durationMs } = await timed(() =>
    withTimeout(async () => {
      const tasks = buildTasksFromAnalysis(ctx.runId, ctx.goal, analysis);
      const executionPlan: ExecutionPlan = {
        planId: `plan_${ctx.runId}`,
        runId: ctx.runId,
        phases: ['scaffold', 'implement', 'verify', 'browser'],
        tasks,
        estimatedDurationMs: tasks.length * 8_000,
        createdAt: new Date(),
      };

      if (!validatePlan(executionPlan)) {
        throw new Error('Generated plan failed dependency validation');
      }

      return executionPlan;
    }, { timeoutMs: 30_000 })
  );

  emitMetric(ctx.runId, 'planning.task_count', plan.tasks.length, 'count');
  runLogger.log(ctx.runId, 'info', `[planning-phase] Plan built — ${plan.tasks.length} tasks`, { planId: plan.planId });

  return { phase: 'planning', success: true, durationMs, output: plan as unknown as Record<string, unknown> };
}
