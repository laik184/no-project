import type { PlannerInput, ExecutionPlan } from '../types/planner.types.ts';
import type { PlanningContext } from './planning-context.ts';
import { createPlanningContext, withAnalysis } from './planning-context.ts';
import { analyzeGoal } from '../analysis/goal-analyzer.ts';
import { classifyApp } from '../analysis/app-classifier.ts';
import { extractRequirements } from '../analysis/requirement-extractor.ts';
import { estimateComplexity } from '../analysis/complexity-estimator.ts';
import { planFrontend } from '../architecture/frontend-planner.ts';
import { planBackend } from '../architecture/backend-planner.ts';
import { planDatabase } from '../architecture/database-planner.ts';
import { planApi } from '../architecture/api-planner.ts';
import { planDeployment } from '../architecture/deployment-planner.ts';
import { buildPhases } from '../decomposition/phase-builder.ts';
import { buildTasksForPhases } from '../decomposition/task-breakdown.ts';
import { buildTaskDependencyGraph } from '../decomposition/dependency-graph.ts';
import { generateMilestones } from '../decomposition/milestone-generator.ts';
import { sequencePipeline } from '../sequencing/pipeline-sequencer.ts';
import { validatePlan } from '../validation/plan-validator.ts';
import { generatePlanId } from '../utils/planning-helpers.ts';
import { plannerLogger } from '../telemetry/planner-logger.ts';

export async function runPlannerEngine(input: PlannerInput): Promise<ExecutionPlan> {
  const ctx = createPlanningContext(input);
  const { runId, goal } = ctx;

  plannerLogger.info(runId, 'Planner engine started');

  const analysis     = analyzeGoal(runId, goal);
  const { appType }  = classifyApp(runId, goal, analysis);
  const requirements = extractRequirements(goal, analysis);
  const { complexity } = estimateComplexity(runId, goal, appType, analysis, requirements);

  const enrichedCtx = withAnalysis(ctx, analysis, appType, complexity, requirements);

  const frontendPlan   = planFrontend(appType, analysis);
  const backendPlan    = planBackend(appType, analysis);
  const databasePlan   = planDatabase(appType, analysis);
  const apiPlan        = planApi(appType, requirements);
  const deploymentPlan = planDeployment(appType, complexity, analysis);

  plannerLogger.info(runId, 'Architecture plans generated', { appType, complexity });

  const phases = buildPhases(runId, appType, complexity, analysis);
  buildTasksForPhases(phases, appType, complexity, analysis, requirements);
  const allTasks = phases.flatMap((p) => p.tasks);

  const graph    = buildTaskDependencyGraph(phases, allTasks);
  const milestones = generateMilestones(phases);

  const { phases: sequencedPhases, tasks: sequencedTasks, executionOrder } =
    sequencePipeline(phases, allTasks, graph);

  plannerLogger.info(runId, 'Tasks sequenced', { taskCount: sequencedTasks.length });

  const partialPlan: Partial<ExecutionPlan> = {
    planId: generatePlanId(),
    runId,
    appType,
    complexity,
    frontendPlan,
    backendPlan,
    databasePlan,
    apiPlan,
    deploymentPlan,
    phases:          sequencedPhases,
    tasks:           sequencedTasks,
    dependencyGraph: graph,
    executionOrder,
    milestones,
  };

  const validationResults = validatePlan(runId, partialPlan);

  if (!validationResults.valid) {
    plannerLogger.warn(runId, 'Plan validation issues', { errors: validationResults.errors });
  }

  const plan: ExecutionPlan = {
    ...(partialPlan as Omit<ExecutionPlan, 'validationResults' | 'createdAt'>),
    validationResults,
    createdAt: new Date(),
  };

  plannerLogger.info(runId, 'Planner engine complete', {
    taskCount: plan.tasks.length,
    phaseCount: plan.phases.length,
    valid: validationResults.valid,
  });

  return plan;
}
