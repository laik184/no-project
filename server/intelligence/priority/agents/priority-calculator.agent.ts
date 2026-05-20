import { TaskInput, UrgencyScore, ImpactScore, DependencyWeight, CombinedScore, PriorityItem } from "../types";
import { weightedScore, complexityScore, levelFromScore } from "../utils/scoring.util";
import { clamp } from "../utils/normalize.util";

export function calculatePriority(
  task: TaskInput,
  urgency: UrgencyScore,
  impact: ImpactScore,
  dependency: DependencyWeight
): PriorityItem {
  const complexity = complexityScore(task.complexity, task.estimatedEffort);

  const combined: CombinedScore = Object.freeze({
    taskId: task.id,
    score: 0,
    urgency: urgency.score,
    impact: impact.score,
    dependency: dependency.weight,
    complexity,
  });

  const rawScore = weightedScore(
    combined.urgency,
    combined.impact,
    combined.dependency,
    combined.complexity
  );

  const overdueBoost = urgency.isOverdue ? 5 : 0;
  const systemBoost   = task.systemCritical ? 3 : 0;
  const score = clamp(Math.round(rawScore + overdueBoost + systemBoost));

  const level = levelFromScore(score);

  const reasons: string[] = [urgency.reason, impact.reason, dependency.reason];
  const reason = reasons.join(" | ");

  return Object.freeze({ taskId: task.id, score, level, reason });
}

export function calculateAllPriorities(
  tasks: readonly TaskInput[],
  urgencies: readonly UrgencyScore[],
  impacts: readonly ImpactScore[],
  dependencies: readonly DependencyWeight[]
): readonly PriorityItem[] {
  const urgencyMap = new Map(urgencies.map((u) => [u.taskId, u]));
  const impactMap  = new Map(impacts.map((i) => [i.taskId, i]));
  const depMap     = new Map(dependencies.map((d) => [d.taskId, d]));

  return Object.freeze(
    tasks.map((task) => {
      const urgency    = urgencyMap.get(task.id)!;
      const impact     = impactMap.get(task.id)!;
      const dependency = depMap.get(task.id)!;
      return calculatePriority(task, urgency, impact, dependency);
    })
  );
}
