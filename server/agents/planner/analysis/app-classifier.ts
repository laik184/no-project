import type { AppType } from '../types/planner.types.ts';
import type { GoalAnalysis } from '../types/planning.types.ts';
import { plannerLogger } from '../telemetry/planner-logger.ts';
import { containsKeyword } from '../utils/planning-helpers.ts';

interface ClassificationResult {
  appType: AppType;
  confidence: number;
  reasoning: string;
}

const SAAS_KEYWORDS      = ['saas', 'subscription', 'multi-tenant', 'tenant', 'workspace', 'plan', 'billing'];
const AI_APP_KEYWORDS    = ['ai', 'llm', 'gpt', 'chat', 'completion', 'embedding', 'vector', 'openai', 'anthropic'];
const ECOMMERCE_KEYWORDS = ['shop', 'store', 'product', 'cart', 'order', 'ecommerce', 'commerce', 'inventory'];
const DASHBOARD_KEYWORDS = ['dashboard', 'analytics', 'metrics', 'report', 'chart', 'stats', 'kpi', 'monitor'];
const AUTH_KEYWORDS      = ['auth', 'login', 'oauth', 'sso', 'identity', 'permission', 'role', 'rbac'];
const BACKEND_KEYWORDS   = ['api', 'rest', 'graphql', 'microservice', 'webhook', 'worker', 'cron', 'queue'];
const CRUD_KEYWORDS      = ['crud', 'manage', 'list', 'create', 'edit', 'delete', 'record', 'form', 'table'];

export function classifyApp(runId: string, goal: string, analysis: GoalAnalysis): ClassificationResult {
  plannerLogger.debug(runId, 'Classifying app type');

  const scores: Record<AppType, number> = {
    crud:       0,
    saas:       0,
    ai_app:     0,
    ecommerce:  0,
    dashboard:  0,
    auth_system:0,
    backend_api:0,
  };

  if (containsKeyword(goal, SAAS_KEYWORDS))      scores.saas       += 30;
  if (containsKeyword(goal, AI_APP_KEYWORDS))    scores.ai_app     += 30;
  if (containsKeyword(goal, ECOMMERCE_KEYWORDS)) scores.ecommerce  += 30;
  if (containsKeyword(goal, DASHBOARD_KEYWORDS)) scores.dashboard  += 30;
  if (containsKeyword(goal, AUTH_KEYWORDS))      scores.auth_system += 25;
  if (containsKeyword(goal, BACKEND_KEYWORDS))   scores.backend_api += 25;
  if (containsKeyword(goal, CRUD_KEYWORDS))      scores.crud       += 20;

  if (analysis.hasAI)       { scores.ai_app  += 20; }
  if (analysis.hasPayments) { scores.saas    += 15; scores.ecommerce += 15; }
  if (analysis.hasAnalytics){ scores.dashboard += 20; scores.saas += 10; }
  if (analysis.hasAuth && !analysis.hasFrontend) { scores.auth_system += 15; }
  if (!analysis.hasFrontend) { scores.backend_api += 20; }

  const topEntry = (Object.entries(scores) as [AppType, number][])
    .sort(([, a], [, b]) => b - a)[0];

  const [appType, topScore] = topEntry;
  const totalWeight = Object.values(scores).reduce((a, b) => a + b, 0) || 1;
  const confidence  = Math.min(100, Math.round((topScore / totalWeight) * 100 * 3));

  const reasoning = `Classified as '${appType}' with score ${topScore} ` +
    `(${confidence}% confidence) based on goal keywords and feature flags.`;

  plannerLogger.info(runId, `App classified: ${appType}`, { confidence });
  return { appType, confidence, reasoning };
}
