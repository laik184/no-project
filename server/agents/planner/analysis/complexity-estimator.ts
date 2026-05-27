import type { AppType, PlanComplexity } from '../types/planner.types.ts';
import type { GoalAnalysis, Requirements } from '../types/planning.types.ts';
import { scoreToComplexity } from '../utils/planning-helpers.ts';
import { plannerLogger } from '../telemetry/planner-logger.ts';

interface ComplexityEstimate {
  complexity: PlanComplexity;
  score: number;
  estimatedTaskCount: number;
  estimatedMinutes: number;
  factors: string[];
}

const APP_TYPE_BASE_SCORES: Record<AppType, number> = {
  crud:        20,
  backend_api: 25,
  auth_system: 30,
  dashboard:   35,
  saas:        55,
  ecommerce:   55,
  ai_app:      60,
};

export function estimateComplexity(
  runId: string,
  goal: string,
  appType: AppType,
  analysis: GoalAnalysis,
  requirements: Requirements,
): ComplexityEstimate {
  let score = APP_TYPE_BASE_SCORES[appType] ?? 30;
  const factors: string[] = [`base score for '${appType}': ${APP_TYPE_BASE_SCORES[appType]}`];

  if (analysis.hasAuth)          { score += 10; factors.push('+10 authentication'); }
  if (analysis.hasPayments)      { score += 15; factors.push('+15 payment integration'); }
  if (analysis.hasRealtime)      { score += 12; factors.push('+12 real-time features'); }
  if (analysis.hasAI)            { score += 10; factors.push('+10 AI integration'); }
  if (analysis.hasFileUpload)    { score += 5;  factors.push('+5 file uploads'); }
  if (analysis.hasSearch)        { score += 5;  factors.push('+5 search'); }
  if (analysis.hasAnalytics)     { score += 8;  factors.push('+8 analytics'); }
  if (analysis.hasNotifications) { score += 5;  factors.push('+5 notifications'); }

  if (requirements.auth.includes('oauth')) { score += 5; factors.push('+5 OAuth'); }
  if (goal.length > 500)  { score += 5;  factors.push('+5 verbose goal'); }
  if (goal.length > 1500) { score += 5;  factors.push('+5 very verbose goal'); }

  score = Math.min(100, score);

  const complexity       = scoreToComplexity(score);
  const estimatedTaskCount = estimateTaskCount(complexity);
  const minutesPerTask   = complexity === 'low' ? 5 : complexity === 'medium' ? 10 : 20;
  const estimatedMinutes = estimatedTaskCount * minutesPerTask;

  plannerLogger.info(runId, `Complexity estimated: ${complexity}`, { score, estimatedTaskCount });

  return { complexity, score, estimatedTaskCount, estimatedMinutes, factors };
}

function estimateTaskCount(complexity: PlanComplexity): number {
  const counts: Record<PlanComplexity, number> = { low: 8, medium: 16, high: 28 };
  return counts[complexity];
}
