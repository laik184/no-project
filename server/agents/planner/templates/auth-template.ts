import type { FrontendPlan, BackendPlan, DatabasePlan, ApiPlan, DeploymentPlan } from '../types/planning.types.ts';

export interface AuthTemplateDefaults {
  frontendPlan:   FrontendPlan;
  backendPlan:    BackendPlan;
  databasePlan:   DatabasePlan;
  apiPlan:        ApiPlan;
  deploymentPlan: DeploymentPlan;
}

export function getAuthTemplateDefaults(): AuthTemplateDefaults {
  return {
    frontendPlan: {
      framework:       'React',
      routing:         'Wouter',
      stateManagement: 'TanStack Query',
      uiLibrary:       'shadcn/ui + Tailwind CSS',
      pages:           ['Login', 'Register', 'ForgotPassword', 'ResetPassword', 'Profile', 'MFA'],
      features:        ['mfa-input', 'social-login', 'password-strength', 'auth-guard', 'session-timeout'],
    },
    backendPlan: {
      framework:  'Express',
      language:   'TypeScript',
      services:   ['AuthService', 'TokenService', 'SessionService', 'PermissionService', 'MfaService'],
      middleware: ['cors', 'json-body-parser', 'auth-middleware', 'rate-limiter', 'csrf-protection', 'error-handler'],
      modules:    ['auth', 'mfa', 'sessions', 'permissions', 'health'],
    },
    databasePlan: {
      type:      'postgresql',
      orm:       'Drizzle ORM',
      entities:  ['User', 'Session', 'Token', 'Permission', 'Role', 'MfaDevice', 'AuditLog'],
      relations: ['User → Session (1:N)', 'User → Role (N:N)', 'Role → Permission (N:N)', 'User → MfaDevice (1:N)'],
      indexing:  ['user.email', 'session.token', 'session.expires_at', 'token.hash', 'token.expires_at'],
    },
    apiPlan: {
      style:     'rest',
      endpoints: [
        { method: 'POST',   path: '/api/auth/register',       description: 'Register new user' },
        { method: 'POST',   path: '/api/auth/login',          description: 'Authenticate user' },
        { method: 'POST',   path: '/api/auth/logout',         description: 'Invalidate session' },
        { method: 'POST',   path: '/api/auth/refresh',        description: 'Refresh access token' },
        { method: 'POST',   path: '/api/auth/forgot-password',description: 'Send password reset email' },
        { method: 'POST',   path: '/api/auth/reset-password', description: 'Reset password with token' },
        { method: 'POST',   path: '/api/auth/mfa/enable',     description: 'Enable MFA' },
        { method: 'POST',   path: '/api/auth/mfa/verify',     description: 'Verify MFA code' },
        { method: 'GET',    path: '/api/users/me',            description: 'Get current user profile' },
      ],
      authStrategy: 'jwt-bearer',
      rateLimiting: true,
      versioning:   false,
    },
    deploymentPlan: {
      platform:     'Replit Reserved VM',
      buildCommand: 'npm run build',
      startCommand: 'node dist/server.js',
      envVars:      ['DATABASE_URL', 'NODE_ENV', 'PORT', 'JWT_SECRET', 'SESSION_SECRET', 'SENDGRID_API_KEY'],
      scaling:      'single instance',
    },
  };
}
