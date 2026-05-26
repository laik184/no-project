export type OrchestrationPhase =
  | 'analyze'
  | 'planning'
  | 'execution'
  | 'verification'
  | 'browser'
  | 'complete'
  | 'failed';

export type OrchestrationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled';

export interface OrchestrationContext {
  runId: string;
  projectId: string;
  goal: string;
  startedAt: Date;
  timeoutMs: number;
  metadata: Record<string, unknown>;
}

export interface TaskPayload {
  taskId: string;
  runId: string;
  type: string;
  priority: TaskPriority;
  input: Record<string, unknown>;
  retryCount: number;
  createdAt: Date;
}

export interface PhaseResult {
  phase: OrchestrationPhase;
  success: boolean;
  durationMs: number;
  output: Record<string, unknown>;
  error?: string;
}

export interface RetryPayload {
  taskId: string;
  runId: string;
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  reason: string;
}

export interface FailurePayload {
  runId: string;
  phase: OrchestrationPhase;
  error: string;
  recoverable: boolean;
  timestamp: Date;
}

export interface MetricPayload {
  runId: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface LifecyclePayload {
  runId: string;
  status: OrchestrationStatus;
  phase?: OrchestrationPhase;
  durationMs?: number;
  timestamp: Date;
}

export interface OrchestrationEventMap {
  'run.started': LifecyclePayload;
  'run.completed': LifecyclePayload;
  'run.failed': FailurePayload;
  'run.cancelled': LifecyclePayload;
  'phase.started': { runId: string; phase: OrchestrationPhase; timestamp: Date };
  'phase.completed': PhaseResult;
  'phase.failed': FailurePayload;
  'task.queued': TaskPayload;
  'task.started': TaskPayload;
  'task.completed': TaskPayload & { result: unknown };
  'task.failed': TaskPayload & { error: string };
  'task.retrying': RetryPayload;
  'metric.recorded': MetricPayload;
}

export type OrchestrationEventName = keyof OrchestrationEventMap;
