import type { GoalAnalysis } from '../types/planning.types.ts';
import { plannerLogger } from '../telemetry/planner-logger.ts';
import { containsKeyword } from '../utils/planning-helpers.ts';

const FRONTEND_KEYWORDS = ['ui', 'page', 'dashboard', 'interface', 'frontend', 'react', 'screen', 'view', 'component'];
const BACKEND_KEYWORDS  = ['api', 'server', 'endpoint', 'backend', 'service', 'handler', 'worker'];
const DATABASE_KEYWORDS = ['database', 'db', 'store', 'persist', 'save', 'records', 'table', 'schema', 'postgres', 'sqlite'];
const AUTH_KEYWORDS     = ['auth', 'login', 'signup', 'register', 'user', 'session', 'jwt', 'password', 'oauth'];
const PAYMENT_KEYWORDS  = ['payment', 'stripe', 'billing', 'subscription', 'checkout', 'pricing', 'invoice'];
const REALTIME_KEYWORDS = ['realtime', 'real-time', 'websocket', 'live', 'streaming', 'sse', 'socket', 'push'];
const AI_KEYWORDS       = ['ai', 'llm', 'gpt', 'openai', 'anthropic', 'embedding', 'vector', 'chat', 'completion'];
const UPLOAD_KEYWORDS   = ['upload', 'file', 'attachment', 'image', 'media', 'storage', 's3'];
const SEARCH_KEYWORDS   = ['search', 'filter', 'query', 'find', 'full-text', 'elasticsearch'];
const ANALYTICS_KEYWORDS= ['analytics', 'metrics', 'stats', 'chart', 'graph', 'report', 'tracking'];
const NOTIFY_KEYWORDS   = ['notification', 'email', 'sms', 'alert', 'notify', 'sendgrid', 'webhook'];

export function analyzeGoal(runId: string, goal: string): GoalAnalysis {
  plannerLogger.info(runId, 'Analyzing goal', { goalLength: goal.length });

  const hasFrontend    = containsKeyword(goal, FRONTEND_KEYWORDS);
  const hasBackend     = containsKeyword(goal, BACKEND_KEYWORDS) || !hasFrontend;
  const hasDatabase    = containsKeyword(goal, DATABASE_KEYWORDS);
  const hasAuth        = containsKeyword(goal, AUTH_KEYWORDS);
  const hasPayments    = containsKeyword(goal, PAYMENT_KEYWORDS);
  const hasRealtime    = containsKeyword(goal, REALTIME_KEYWORDS);
  const hasAI          = containsKeyword(goal, AI_KEYWORDS);
  const hasFileUpload  = containsKeyword(goal, UPLOAD_KEYWORDS);
  const hasSearch      = containsKeyword(goal, SEARCH_KEYWORDS);
  const hasAnalytics   = containsKeyword(goal, ANALYTICS_KEYWORDS);
  const hasNotifications = containsKeyword(goal, NOTIFY_KEYWORDS);

  const deploymentNeeds = hasRealtime
    ? 'persistent-server'
    : hasAI
    ? 'serverless-with-gpu'
    : 'standard-web';

  const summary = buildSummary({
    hasFrontend, hasBackend, hasDatabase, hasAuth,
    hasPayments, hasRealtime, hasAI, hasFileUpload,
    hasSearch, hasAnalytics, hasNotifications,
  });

  plannerLogger.info(runId, 'Goal analysis complete', { summary });

  return {
    summary,
    hasFrontend,
    hasBackend,
    hasDatabase,
    hasAuth,
    hasPayments,
    hasRealtime,
    hasAI,
    hasFileUpload,
    hasSearch,
    hasAnalytics,
    hasNotifications,
    deploymentNeeds,
  };
}

function buildSummary(flags: Omit<GoalAnalysis, 'summary' | 'deploymentNeeds'>): string {
  const parts: string[] = [];
  if (flags.hasFrontend)     parts.push('frontend UI');
  if (flags.hasBackend)      parts.push('backend API');
  if (flags.hasDatabase)     parts.push('database');
  if (flags.hasAuth)         parts.push('authentication');
  if (flags.hasPayments)     parts.push('payments');
  if (flags.hasRealtime)     parts.push('real-time features');
  if (flags.hasAI)           parts.push('AI integration');
  if (flags.hasFileUpload)   parts.push('file uploads');
  if (flags.hasSearch)       parts.push('search');
  if (flags.hasAnalytics)    parts.push('analytics');
  if (flags.hasNotifications)parts.push('notifications');
  return parts.length > 0
    ? `Application with: ${parts.join(', ')}.`
    : 'General-purpose application.';
}
