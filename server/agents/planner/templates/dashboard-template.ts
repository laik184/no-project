import type { FrontendPlan, BackendPlan, DatabasePlan, ApiPlan, DeploymentPlan } from '../types/planning.types.ts';

export interface DashboardTemplateDefaults {
  frontendPlan:   FrontendPlan;
  backendPlan:    BackendPlan;
  databasePlan:   DatabasePlan;
  apiPlan:        ApiPlan;
  deploymentPlan: DeploymentPlan;
}

export function getDashboardTemplateDefaults(): DashboardTemplateDefaults {
  return {
    frontendPlan: {
      framework:       'React',
      routing:         'Wouter',
      stateManagement: 'TanStack Query',
      uiLibrary:       'shadcn/ui + Tailwind CSS + Recharts',
      pages:           ['Overview', 'Reports', 'Analytics', 'Settings', 'Export'],
      features:        ['chart-widgets', 'date-picker', 'export-csv', 'filter-panel', 'kpi-cards', 'data-table', 'auth-guard'],
    },
    backendPlan: {
      framework:  'Express',
      language:   'TypeScript',
      services:   ['MetricsService', 'ReportService', 'AggregationService', 'ExportService'],
      middleware: ['cors', 'json-body-parser', 'auth-middleware', 'cache-middleware', 'error-handler', 'request-logger'],
      modules:    ['metrics', 'reports', 'export', 'auth', 'health'],
    },
    databasePlan: {
      type:      'postgresql',
      orm:       'Drizzle ORM',
      entities:  ['User', 'Metric', 'Report', 'DataSource', 'Dashboard', 'Widget'],
      relations: ['User → Report (1:N)', 'DataSource → Metric (1:N)', 'Dashboard → Widget (1:N)'],
      indexing:  ['metric.source_id', 'metric.recorded_at', 'report.user_id', 'metric.name'],
    },
    apiPlan: {
      style:     'rest',
      endpoints: [
        { method: 'GET',  path: '/api/metrics',            description: 'Get aggregated metrics' },
        { method: 'GET',  path: '/api/metrics/:name',      description: 'Get specific metric history' },
        { method: 'GET',  path: '/api/reports',            description: 'List saved reports' },
        { method: 'POST', path: '/api/reports',            description: 'Generate new report' },
        { method: 'GET',  path: '/api/reports/:id/export', description: 'Export report as CSV' },
        { method: 'GET',  path: '/api/datasources',        description: 'List data sources' },
        { method: 'GET',  path: '/health',                  description: 'Health check' },
      ],
      authStrategy: 'jwt-bearer',
      rateLimiting: false,
      versioning:   false,
    },
    deploymentPlan: {
      platform:     'Replit Reserved VM',
      buildCommand: 'npm run build',
      startCommand: 'node dist/server.js',
      envVars:      ['DATABASE_URL', 'NODE_ENV', 'PORT', 'JWT_SECRET'],
      scaling:      'single instance',
    },
  };
}
