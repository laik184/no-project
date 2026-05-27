import type {
  FrontendPlan,
  BackendPlan,
  DatabasePlan,
  ApiPlan,
  DeploymentPlan,
  DependencyGraph,
  Milestone,
  ValidationResult,
} from './planning.types.ts';

export type AppType =
  | 'crud'
  | 'saas'
  | 'ai_app'
  | 'ecommerce'
  | 'dashboard'
  | 'auth_system'
  | 'backend_api';

export type PlanComplexity = 'low' | 'medium' | 'high';
export type PlanningStatus = 'pending' | 'running' | 'completed' | 'failed';
export type PhaseType = 'setup' | 'backend' | 'frontend' | 'verification' | 'deployment';
export type TaskCategory = 'setup' | 'schema' | 'api' | 'auth' | 'ui' | 'test' | 'deploy';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export interface PlanTask {
  id: string;
  phase: PhaseType;
  category: TaskCategory;
  title: string;
  description: string;
  dependencies: string[];
  priority: TaskPriority;
  estimatedMinutes: number;
}

export interface PlanPhase {
  id: string;
  type: PhaseType;
  title: string;
  description: string;
  tasks: PlanTask[];
  order: number;
}

export interface ExecutionPlan {
  planId: string;
  runId: string;
  appType: AppType;
  complexity: PlanComplexity;
  frontendPlan: FrontendPlan;
  backendPlan: BackendPlan;
  databasePlan: DatabasePlan;
  apiPlan: ApiPlan;
  deploymentPlan: DeploymentPlan;
  phases: PlanPhase[];
  tasks: PlanTask[];
  dependencyGraph: DependencyGraph;
  executionOrder: string[];
  milestones: Milestone[];
  validationResults: ValidationResult;
  createdAt: Date;
}

export interface PlannerInput {
  runId: string;
  projectId: string;
  goal: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface PlannerResult {
  ok: boolean;
  plan?: ExecutionPlan;
  error?: string;
  durationMs: number;
}
