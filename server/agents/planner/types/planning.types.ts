export interface FrontendPlan {
  framework: string;
  routing: string;
  stateManagement: string;
  uiLibrary: string;
  pages: string[];
  features: string[];
}

export interface BackendPlan {
  framework: string;
  language: string;
  services: string[];
  middleware: string[];
  modules: string[];
}

export interface DatabasePlan {
  type: 'postgresql' | 'sqlite' | 'mongodb' | 'none';
  orm: string;
  entities: string[];
  relations: string[];
  indexing: string[];
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
}

export interface ApiPlan {
  style: 'rest' | 'graphql' | 'trpc';
  endpoints: ApiEndpoint[];
  authStrategy: string;
  rateLimiting: boolean;
  versioning: boolean;
}

export interface DeploymentPlan {
  platform: string;
  buildCommand: string;
  startCommand: string;
  envVars: string[];
  scaling: string;
}

export interface GoalAnalysis {
  summary: string;
  hasFrontend: boolean;
  hasBackend: boolean;
  hasDatabase: boolean;
  hasAuth: boolean;
  hasPayments: boolean;
  hasRealtime: boolean;
  hasAI: boolean;
  hasFileUpload: boolean;
  hasSearch: boolean;
  hasAnalytics: boolean;
  hasNotifications: boolean;
  deploymentNeeds: string;
}

export interface Requirements {
  apis: string[];
  auth: string[];
  search: boolean;
  analytics: boolean;
  uploads: boolean;
  payments: boolean;
  notifications: boolean;
  realtime: boolean;
  aiIntegration: boolean;
  rawFeatures: string[];
}

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
  topologicalOrder: string[];
}

export interface Milestone {
  id: string;
  title: string;
  phase: string;
  dependsOn: string[];
  estimatedMinutes: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: Date;
}
