import type { AppType } from '../types/planner.types.ts';
import type { ApiPlan, ApiEndpoint, Requirements } from '../types/planning.types.ts';

const ENDPOINT_SETS: Record<AppType, ApiEndpoint[]> = {
  crud: [
    { method: 'GET',    path: '/api/records',     description: 'List all records' },
    { method: 'POST',   path: '/api/records',     description: 'Create record' },
    { method: 'GET',    path: '/api/records/:id', description: 'Get record by ID' },
    { method: 'PUT',    path: '/api/records/:id', description: 'Update record' },
    { method: 'DELETE', path: '/api/records/:id', description: 'Delete record' },
  ],
  saas: [
    { method: 'POST',   path: '/api/auth/login',          description: 'User login' },
    { method: 'POST',   path: '/api/auth/register',       description: 'User registration' },
    { method: 'GET',    path: '/api/workspaces',          description: 'List workspaces' },
    { method: 'POST',   path: '/api/billing/subscribe',   description: 'Create subscription' },
    { method: 'GET',    path: '/api/billing/usage',       description: 'Get usage metrics' },
  ],
  ai_app: [
    { method: 'POST',   path: '/api/chat',            description: 'Send chat message' },
    { method: 'GET',    path: '/api/conversations',   description: 'List conversations' },
    { method: 'DELETE', path: '/api/conversations/:id', description: 'Delete conversation' },
    { method: 'GET',    path: '/api/models',          description: 'List available models' },
  ],
  ecommerce: [
    { method: 'GET',    path: '/api/products',       description: 'List products' },
    { method: 'GET',    path: '/api/products/:id',   description: 'Get product' },
    { method: 'POST',   path: '/api/cart',           description: 'Add to cart' },
    { method: 'POST',   path: '/api/checkout',       description: 'Create checkout session' },
    { method: 'GET',    path: '/api/orders',         description: 'List user orders' },
  ],
  dashboard: [
    { method: 'GET',    path: '/api/metrics',        description: 'Get metrics' },
    { method: 'GET',    path: '/api/reports',        description: 'List reports' },
    { method: 'POST',   path: '/api/reports',        description: 'Generate report' },
    { method: 'GET',    path: '/api/export',         description: 'Export data as CSV' },
  ],
  auth_system: [
    { method: 'POST',   path: '/api/auth/login',    description: 'Authenticate user' },
    { method: 'POST',   path: '/api/auth/logout',   description: 'Invalidate session' },
    { method: 'POST',   path: '/api/auth/refresh',  description: 'Refresh token' },
    { method: 'GET',    path: '/api/users/me',      description: 'Get current user' },
    { method: 'PATCH',  path: '/api/users/me',      description: 'Update profile' },
  ],
  backend_api: [
    { method: 'GET',    path: '/api/resources',     description: 'List resources' },
    { method: 'POST',   path: '/api/resources',     description: 'Create resource' },
    { method: 'GET',    path: '/health',             description: 'Health check' },
  ],
};

export function planApi(appType: AppType, requirements: Requirements): ApiPlan {
  const style         = requirements.apis.includes('graphql') ? 'graphql'
    : requirements.apis.includes('trpc') ? 'trpc'
    : 'rest';

  const authStrategy  = requirements.auth.includes('oauth') ? 'oauth2 + jwt'
    : requirements.auth.includes('session') ? 'session-cookie'
    : requirements.auth.length > 0 ? 'jwt-bearer'
    : 'none';

  return {
    style,
    endpoints:    ENDPOINT_SETS[appType] ?? ENDPOINT_SETS.backend_api,
    authStrategy,
    rateLimiting: requirements.auth.length > 0 || appType === 'saas',
    versioning:   appType === 'saas' || appType === 'backend_api',
  };
}
