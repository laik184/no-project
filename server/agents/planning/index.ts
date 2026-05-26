/**
 * server/agents/planning/index.ts — STUB
 * Planning agent was removed. Uses the kept Planner Agent internally.
 */

import { buildTaskGraph } from "../planner/planner-agent.ts";

export interface PlanPhase {
  id:        string;
  name:      string;
  goal:      string;
  dependsOn: string[];
  tools:     string[];
}

export interface ExecutionPlan {
  phases:      PlanPhase[];
  totalSteps:  number;
  estimatedMs: number;
  riskLevel:   "low" | "medium" | "high";
  replayable:  boolean;
}

export interface PlannerResult {
  plan:           ExecutionPlan;
  overallSuccess: boolean;
  totalSteps:     number;
  durationMs:     number;
  phaseResults:   Array<{ phaseId: string; success: boolean; steps: number; summary: string }>;
}

export async function runPlannerAgent(opts: {
  projectId:       number;
  runId:           string;
  goal:            string;
  systemPrompt?:   string;
  maxStepsPerPhase?: number;
  memoryContext?:  string;
  signal?:         AbortSignal;
}): Promise<PlannerResult> {
  const t0 = Date.now();
  const graph = buildTaskGraph(opts.goal);

  const phases: PlanPhase[] = graph.tasks.map(task => ({
    id:        task.id,
    name:      task.description.slice(0, 60),
    goal:      task.description,
    dependsOn: task.dependsOn,
    tools:     [],
  }));

  const plan: ExecutionPlan = {
    phases,
    totalSteps:  phases.length,
    estimatedMs: phases.length * 30_000,
    riskLevel:   "medium",
    replayable:  true,
  };

  return {
    plan,
    overallSuccess: true,
    totalSteps:     phases.length,
    durationMs:     Date.now() - t0,
    phaseResults:   phases.map(p => ({
      phaseId: p.id,
      success: true,
      steps:   1,
      summary: p.goal.slice(0, 100),
    })),
  };
}

export function needsPlanning(goal: string): boolean {
  const complexPatterns = [
    /build|create|implement|add feature/i,
    /refactor|restructure|migrate/i,
    /\band\b.*\band\b/i,
    /full.?stack|end.?to.?end/i,
  ];
  return complexPatterns.some(p => p.test(goal)) || goal.length > 200;
}
