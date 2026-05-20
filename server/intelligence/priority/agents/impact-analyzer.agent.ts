import { TaskInput, ImpactScore } from "../types";
import { clamp } from "../utils/normalize.util";

const TAG_RISK_MAP: Record<string, number> = {
  security:      30,
  auth:          28,
  payment:       30,
  database:      25,
  deploy:        22,
  performance:   18,
  api:           20,
  migration:     24,
  critical:      30,
  breaking:      28,
  regression:    26,
  production:    25,
  infrastructure:22,
};

export function analyzeImpact(task: TaskInput): ImpactScore {
  const systemImpact = computeSystemImpact(task);
  const userImpact = computeUserImpact(task);
  const riskLevel = computeRiskLevel(task);

  const score = clamp(Math.round(systemImpact * 0.4 + userImpact * 0.35 + riskLevel * 0.25));

  const reasons: string[] = [];
  if (systemImpact >= 70) reasons.push("high system impact");
  if (userImpact >= 70)   reasons.push("high user impact");
  if (riskLevel >= 70)    reasons.push("elevated risk");
  if (reasons.length === 0) reasons.push("standard impact profile");

  return Object.freeze({
    taskId: task.id,
    score,
    systemImpact: Math.round(systemImpact),
    userImpact: Math.round(userImpact),
    riskLevel: Math.round(riskLevel),
    reason: reasons.join(", "),
  });
}

function computeSystemImpact(task: TaskInput): number {
  let base = (task.impact ?? 0.5) * 60;
  if (task.systemCritical) base += 30;
  const tagBoost = getTagBoost(task.tags, ["database", "migration", "deploy", "infrastructure", "api"]);
  return clamp(base + tagBoost);
}

function computeUserImpact(task: TaskInput): number {
  let base = task.userFacing ? 60 : 20;
  const tagBoost = getTagBoost(task.tags, ["payment", "auth", "performance", "ui", "api"]);
  return clamp(base + tagBoost);
}

function computeRiskLevel(task: TaskInput): number {
  let risk = 10;
  for (const tag of task.tags ?? []) {
    const tagRisk = TAG_RISK_MAP[tag.toLowerCase()];
    if (tagRisk) risk = Math.max(risk, tagRisk);
  }
  if (task.systemCritical) risk = Math.max(risk, 25);
  if ((task.complexity ?? 0) > 0.8) risk += 10;
  return clamp(risk * 3);
}

function getTagBoost(tags: readonly string[] | undefined, targetTags: string[]): number {
  if (!tags || tags.length === 0) return 0;
  const matched = tags.filter((t) => targetTags.includes(t.toLowerCase())).length;
  return Math.min(matched * 8, 30);
}

export function analyzeAllImpacts(tasks: readonly TaskInput[]): readonly ImpactScore[] {
  return Object.freeze(tasks.map(analyzeImpact));
}
