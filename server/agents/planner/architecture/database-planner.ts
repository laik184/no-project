import type { AppType } from '../types/planner.types.ts';
import type { DatabasePlan, GoalAnalysis } from '../types/planning.types.ts';

const ENTITY_SETS: Record<AppType, string[]> = {
  crud:        ['Record', 'Category'],
  saas:        ['User', 'Workspace', 'Subscription', 'Plan', 'AuditLog'],
  ai_app:      ['User', 'Conversation', 'Message', 'Embedding'],
  ecommerce:   ['User', 'Product', 'Category', 'Order', 'OrderItem', 'Cart', 'Review'],
  dashboard:   ['User', 'Metric', 'Report', 'DataSource'],
  auth_system: ['User', 'Session', 'Token', 'Permission', 'Role'],
  backend_api: ['Resource', 'ApiKey'],
};

const RELATION_SETS: Record<AppType, string[]> = {
  crud:        ['Category → Record (1:N)'],
  saas:        ['User → Workspace (N:N)', 'Workspace → Subscription (1:1)', 'Subscription → Plan (N:1)'],
  ai_app:      ['User → Conversation (1:N)', 'Conversation → Message (1:N)'],
  ecommerce:   ['User → Order (1:N)', 'Order → OrderItem (1:N)', 'Product → OrderItem (N:N)', 'Product → Category (N:1)'],
  dashboard:   ['User → Report (1:N)', 'DataSource → Metric (1:N)'],
  auth_system: ['User → Session (1:N)', 'User → Role (N:N)', 'Role → Permission (N:N)'],
  backend_api: ['ApiKey → Resource (N:N)'],
};

const INDEX_SETS: Record<AppType, string[]> = {
  crud:        ['record.category_id', 'record.created_at'],
  saas:        ['user.email', 'workspace.slug', 'subscription.status'],
  ai_app:      ['conversation.user_id', 'message.conversation_id', 'embedding.vector'],
  ecommerce:   ['product.sku', 'order.user_id', 'order.status', 'product.category_id'],
  dashboard:   ['metric.source_id', 'metric.recorded_at', 'report.user_id'],
  auth_system: ['user.email', 'session.token', 'token.expires_at'],
  backend_api: ['resource.key', 'api_key.hash'],
};

export function planDatabase(appType: AppType, analysis: GoalAnalysis): DatabasePlan {
  const needsDatabase = analysis.hasDatabase ||
    analysis.hasAuth ||
    analysis.hasPayments ||
    appType !== 'backend_api';

  if (!needsDatabase) {
    return { type: 'none', orm: 'none', entities: [], relations: [], indexing: [] };
  }

  const extraEntities: string[] = [];
  if (analysis.hasFileUpload)    extraEntities.push('FileAttachment');
  if (analysis.hasNotifications) extraEntities.push('Notification');
  if (analysis.hasAnalytics)     extraEntities.push('AnalyticsEvent');

  return {
    type:      'postgresql',
    orm:       'Drizzle ORM',
    entities:  [...new Set([...(ENTITY_SETS[appType] ?? ['Record']), ...extraEntities])],
    relations: RELATION_SETS[appType] ?? [],
    indexing:  INDEX_SETS[appType]  ?? [],
  };
}
