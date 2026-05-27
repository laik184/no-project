import type { Requirements } from '../types/planning.types.ts';
import type { GoalAnalysis } from '../types/planning.types.ts';
import { containsKeyword } from '../utils/planning-helpers.ts';

const REST_KEYWORDS    = ['rest', 'api', 'endpoint', 'http', 'json'];
const GRAPHQL_KEYWORDS = ['graphql', 'query', 'mutation', 'subscription'];
const TRPC_KEYWORDS    = ['trpc', 'type-safe api'];

const JWT_KEYWORDS     = ['jwt', 'token', 'bearer'];
const SESSION_KEYWORDS = ['session', 'cookie', 'csrf'];
const OAUTH_KEYWORDS   = ['oauth', 'google login', 'github login', 'social login'];

export function extractRequirements(goal: string, analysis: GoalAnalysis): Requirements {
  const apis = extractApiTypes(goal);
  const auth = extractAuthTypes(goal, analysis);

  const rawFeatures = buildRawFeatures(analysis);

  return {
    apis,
    auth,
    search:        analysis.hasSearch,
    analytics:     analysis.hasAnalytics,
    uploads:       analysis.hasFileUpload,
    payments:      analysis.hasPayments,
    notifications: analysis.hasNotifications,
    realtime:      analysis.hasRealtime,
    aiIntegration: analysis.hasAI,
    rawFeatures,
  };
}

function extractApiTypes(goal: string): string[] {
  const apis: string[] = [];
  if (containsKeyword(goal, GRAPHQL_KEYWORDS)) apis.push('graphql');
  else if (containsKeyword(goal, TRPC_KEYWORDS)) apis.push('trpc');
  else apis.push('rest');
  return apis;
}

function extractAuthTypes(goal: string, analysis: GoalAnalysis): string[] {
  if (!analysis.hasAuth) return [];
  const auth: string[] = [];
  if (containsKeyword(goal, JWT_KEYWORDS))     auth.push('jwt');
  if (containsKeyword(goal, SESSION_KEYWORDS)) auth.push('session');
  if (containsKeyword(goal, OAUTH_KEYWORDS))   auth.push('oauth');
  if (auth.length === 0)                       auth.push('jwt');
  return auth;
}

function buildRawFeatures(analysis: GoalAnalysis): string[] {
  const features: string[] = [];
  if (analysis.hasAuth)          features.push('authentication');
  if (analysis.hasPayments)      features.push('payment processing');
  if (analysis.hasRealtime)      features.push('real-time communication');
  if (analysis.hasAI)            features.push('AI/LLM integration');
  if (analysis.hasFileUpload)    features.push('file uploads');
  if (analysis.hasSearch)        features.push('search functionality');
  if (analysis.hasAnalytics)     features.push('analytics & reporting');
  if (analysis.hasNotifications) features.push('push/email notifications');
  return features;
}
