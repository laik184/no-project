import type { FrontendPlan, BackendPlan, DatabasePlan, ApiPlan, DeploymentPlan } from '../types/planning.types.ts';

export interface CrudTemplateDefaults {
  frontendPlan:   FrontendPlan;
  backendPlan:    BackendPlan;
  databasePlan:   DatabasePlan;
  apiPlan:        ApiPlan;
  deploymentPlan: DeploymentPlan;
}

export function getCrudTemplateDefaults(): CrudTemplateDefaults {
  return {
    frontendPlan: {
      framework:       'React',
      routing:         'Wouter',
      stateManagement: 'TanStack Query',
      uiLibrary:       'shadcn/ui + Tailwind CSS',
      pages:           ['Home', 'List', 'Detail', 'Create', 'Edit'],
      features:        ['data-table', 'form-validation', 'pagination', 'search-bar', 'sort-headers'],
    },
    backendPlan: {
      framework:  'Express',
      language:   'TypeScript',
      services:   ['CrudService', 'ValidationService'],
      middleware: ['cors', 'json-body-parser', 'error-handler', 'request-logger'],
      modules:    ['crud', 'health'],
    },
    databasePlan: {
      type:      'postgresql',
      orm:       'Drizzle ORM',
      entities:  ['Record', 'Category'],
      relations: ['Category → Record (1:N)'],
      indexing:  ['record.category_id', 'record.created_at'],
    },
    apiPlan: {
      style:     'rest',
      endpoints: [
        { method: 'GET',    path: '/api/records',       description: 'List records with pagination' },
        { method: 'POST',   path: '/api/records',       description: 'Create new record' },
        { method: 'GET',    path: '/api/records/:id',   description: 'Get single record' },
        { method: 'PUT',    path: '/api/records/:id',   description: 'Update record' },
        { method: 'DELETE', path: '/api/records/:id',   description: 'Delete record' },
        { method: 'GET',    path: '/api/categories',    description: 'List categories' },
        { method: 'GET',    path: '/health',             description: 'Health check' },
      ],
      authStrategy: 'none',
      rateLimiting: false,
      versioning:   false,
    },
    deploymentPlan: {
      platform:     'Replit Reserved VM',
      buildCommand: 'npm run build',
      startCommand: 'node dist/server.js',
      envVars:      ['DATABASE_URL', 'NODE_ENV', 'PORT'],
      scaling:      'single instance',
    },
  };
}
