import type { AppType } from '../types/planner.types.ts';
import type { BackendPlan, GoalAnalysis } from '../types/planning.types.ts';

const SERVICE_SETS: Record<AppType, string[]> = {
  crud:        ['CrudService', 'ValidationService'],
  saas:        ['UserService', 'BillingService', 'SubscriptionService', 'WorkspaceService'],
  ai_app:      ['LLMService', 'EmbeddingService', 'ChatService', 'HistoryService'],
  ecommerce:   ['ProductService', 'OrderService', 'CartService', 'InventoryService'],
  dashboard:   ['MetricsService', 'ReportService', 'AggregationService'],
  auth_system: ['AuthService', 'TokenService', 'SessionService', 'PermissionService'],
  backend_api: ['ApiService', 'ValidationService'],
};

const MODULE_SETS: Record<AppType, string[]> = {
  crud:        ['crud', 'health'],
  saas:        ['auth', 'billing', 'workspace', 'health'],
  ai_app:      ['llm', 'embedding', 'chat', 'health'],
  ecommerce:   ['catalog', 'orders', 'payments', 'health'],
  dashboard:   ['metrics', 'reports', 'export', 'health'],
  auth_system: ['auth', 'mfa', 'sessions', 'health'],
  backend_api: ['api', 'health'],
};

export function planBackend(appType: AppType, analysis: GoalAnalysis): BackendPlan {
  const baseServices = SERVICE_SETS[appType] ?? ['ApiService'];
  const baseModules  = MODULE_SETS[appType]  ?? ['api', 'health'];
  const extraServices: string[] = [];
  const extraModules:  string[] = [];

  if (analysis.hasAuth && !baseModules.includes('auth')) {
    extraServices.push('AuthService');
    extraModules.push('auth');
  }
  if (analysis.hasNotifications) {
    extraServices.push('NotificationService');
    extraModules.push('notifications');
  }
  if (analysis.hasFileUpload) {
    extraServices.push('StorageService');
    extraModules.push('storage');
  }
  if (analysis.hasSearch) {
    extraServices.push('SearchService');
    extraModules.push('search');
  }

  const middleware = buildMiddleware(analysis);

  return {
    framework:  'Express',
    language:   'TypeScript',
    services:   [...new Set([...baseServices, ...extraServices])],
    middleware,
    modules:    [...new Set([...baseModules, ...extraModules])],
  };
}

function buildMiddleware(analysis: GoalAnalysis): string[] {
  const middleware = ['cors', 'json-body-parser', 'error-handler', 'request-logger'];
  if (analysis.hasAuth)     middleware.push('auth-middleware', 'rate-limiter');
  if (analysis.hasFileUpload) middleware.push('multer');
  return middleware;
}
