import type { OrchestrationPhase, OrchestrationStatus, TaskPriority } from '../../../orchestration/events/event-types.ts';

export type SupervisorStatus = 'idle' | 'active' | 'paused' | 'shutdown';

export type ExecutionMode = 'simple' | 'standard' | 'complex';

export type GoalCategory =
  | 'crud'
  | 'saas_dashboard'
  | 'ai_app'
  | 'auth_system'
  | 'backend_api'
  | 'database_ops'
  | 'unknown';

export type LoopRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type EscalationReason =
  | 'max_retries_exceeded'
  | 'hard_failure'
  | 'loop_detected'
  | 'timeout_exceeded'
  | 'stuck_task';

export interface SupervisorSession {
  sessionId: string;
  runId: string;
  projectId: string;
  goal: string;
  mode: ExecutionMode;
  category: GoalCategory;
  status: SupervisorStatus;
  startedAt: Date;
  endedAt: Date | null;
  currentPhase: OrchestrationPhase | null;
  retryCount: number;
  metadata: Record<string, unknown>;
}

export interface ComplexityResult {
  score: number;
  mode: ExecutionMode;
  estimatedTaskCount: number;
  requiresBrowser: boolean;
  requiresVerification: boolean;
  factors: string[];
}

export interface ClassificationResult {
  category: GoalCategory;
  confidence: number;
  tags: string[];
  reasoning: string;
}

export interface SupervisorDecision {
  action: 'continue' | 'retry' | 'escalate' | 'abort' | 'skip';
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface LoopDetectionResult {
  detected: boolean;
  risk: LoopRiskLevel;
  pattern?: string;
  occurrences?: number;
}

export interface ExecutionHealth {
  runId: string;
  healthy: boolean;
  stuckTasks: string[];
  timedOutPhases: OrchestrationPhase[];
  retryExhausted: string[];
  loopRisk: LoopRiskLevel;
  checkedAt: Date;
}

export interface SupervisorRunResult {
  sessionId: string;
  runId: string;
  success: boolean;
  mode: ExecutionMode;
  category: GoalCategory;
  durationMs: number;
  retries: number;
  failedPhase?: OrchestrationPhase;
  error?: string;
}

export interface PhaseDispatch {
  phase: OrchestrationPhase;
  runId: string;
  timeoutMs: number;
  retryable: boolean;
  priority: TaskPriority;
}

export type SupervisorEventName =
  | 'supervisor.started'
  | 'supervisor.cycle.started'
  | 'supervisor.cycle.completed'
  | 'supervisor.cycle.failed'
  | 'supervisor.decision.made'
  | 'supervisor.loop.detected'
  | 'supervisor.escalated'
  | 'supervisor.shutdown';

export { OrchestrationPhase, OrchestrationStatus, TaskPriority };
