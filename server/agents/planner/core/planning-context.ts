import type { PlannerInput, AppType, PlanComplexity } from '../types/planner.types.ts';
import type { GoalAnalysis, Requirements } from '../types/planning.types.ts';

export interface PlanningContext {
  runId:       string;
  projectId:   string;
  goal:        string;
  timeoutMs:   number;
  metadata:    Record<string, unknown>;
  analysis:    GoalAnalysis | null;
  appType:     AppType | null;
  complexity:  PlanComplexity | null;
  requirements:Requirements | null;
  createdAt:   Date;
}

export function createPlanningContext(input: PlannerInput): PlanningContext {
  return {
    runId:        input.runId,
    projectId:    input.projectId,
    goal:         input.goal,
    timeoutMs:    input.timeoutMs ?? 60_000,
    metadata:     input.metadata ?? {},
    analysis:     null,
    appType:      null,
    complexity:   null,
    requirements: null,
    createdAt:    new Date(),
  };
}

export function withAnalysis(
  ctx: PlanningContext,
  analysis: GoalAnalysis,
  appType: AppType,
  complexity: PlanComplexity,
  requirements: Requirements,
): PlanningContext {
  return { ...ctx, analysis, appType, complexity, requirements };
}

export function isContextReady(ctx: PlanningContext): boolean {
  return (
    ctx.analysis     !== null &&
    ctx.appType      !== null &&
    ctx.complexity   !== null &&
    ctx.requirements !== null
  );
}
