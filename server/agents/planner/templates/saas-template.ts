import type { ExecutionPlan } from '../types/planner.types.ts';
import type { FrontendPlan, BackendPlan, DatabasePlan, ApiPlan, DeploymentPlan } from '../types/planning.types.ts';

export interface SaasTemplateDefaults {
  frontendPlan: FrontendPlan;
  backendPlan:  BackendPlan;
  databasePlan: DatabasePlan;
  apiPlan:      ApiPlan;
  deploymentPlan: DeploymentPlan;
}

export function getSaasTemplateDefaults(): SaasTemplateDefaults {
  return {
    frontendPlan: {
      framework:       'React',
      routing:         'Wouter',
      stateManagement: 'TanStack Query',
      uiLibrary:       'shadcn/ui + Tailwind CSS',
      pages:           ['Landing', 'Dashboard', 'Settings', 'Billing', 'Profile', 'Team'],
      features:        ['sidebar-nav', 'plan-selector', 'usage-meter', 'auth-guard', 'user-menu', 'notification-bell'],
    },
    backendPlan: {
      framework:  'Express',
      language:   'TypeScript',
      services:   ['AuthService', 'UserService', 'WorkspaceService', 'BillingService', 'SubscriptionService'],
      middleware: ['cors', 'json-body-parser', 'auth-middleware', 'rate-limiter', 'error-handler', 'request-logger'],
      modules:    ['auth', 'billing', 'workspace', 'users', 'health'],
    },
    databasePlan: {
      type:      'postgresql',
      orm:       'Drizzle ORM',
      entities:  ['User', 'Workspace', 'Subscription', 'Plan', 'AuditLog', 'ApiKey'],
      relations: ['User → Workspace (N:N)', 'Workspace → Subscription (1:1)', 'Subscription → Plan (N:1)'],
      indexing:  ['user.email', 'workspace.slug', 'subscription.status', 'api_key.hash'],
    },
    apiPlan: {
      style:        'rest',
      endpoints: [
        { method: 'POST',  path: '/api/auth/login',        description: 'Authenticate user' },
        { method: 'POST',  path: '/api/auth/register',     description: 'Register new user' },
        { method: 'GET',   path: '/api/workspaces',        description: 'List workspaces' },
        { method: 'POST',  path: '/api/workspaces',        description: 'Create workspace' },
        { method: 'GET',   path: '/api/billing/plans',     description: 'List available plans' },
        { method: 'POST',  path: '/api/billing/subscribe', description: 'Subscribe to plan' },
        { method: 'GET',   path: '/api/users/me',          description: 'Get current user' },
        { method: 'PATCH', path: '/api/users/me',          description: 'Update profile' },
      ],
      authStrategy: 'jwt-bearer',
      rateLimiting: true,
      versioning:   true,
    },
    deploymentPlan: {
      platform:     'Replit Autoscale',
      buildCommand: 'npm run build',
      startCommand: 'node dist/server.js',
      envVars:      ['DATABASE_URL', 'NODE_ENV', 'PORT', 'SESSION_SECRET', 'JWT_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
      scaling:      'horizontal auto-scaling',
    },
  };
}

export function applySaasDefaults(plan: Partial<ExecutionPlan>): Partial<ExecutionPlan> {
  const defaults = getSaasTemplateDefaults();
  return {
    ...plan,
    frontendPlan:   plan.frontendPlan   ?? defaults.frontendPlan,
    backendPlan:    plan.backendPlan    ?? defaults.backendPlan,
    databasePlan:   plan.databasePlan   ?? defaults.databasePlan,
    apiPlan:        plan.apiPlan        ?? defaults.apiPlan,
    deploymentPlan: plan.deploymentPlan ?? defaults.deploymentPlan,
  };
}
