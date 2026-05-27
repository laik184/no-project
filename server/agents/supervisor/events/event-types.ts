import type {
  OrchestrationPhase,
  OrchestrationStatus,
  LifecyclePayload,
  FailurePayload,
} from '../../../orchestration/events/event-types.ts';
import type {
  ExecutionMode,
  GoalCategory,
  LoopRiskLevel,
  EscalationReason,
  SupervisorStatus,
} from '../types/supervisor.types.ts';

export interface SupervisorStartedPayload {
  sessionId: string;
  runId: string;
  projectId: string;
  mode: ExecutionMode;
  category: GoalCategory;
  timestamp: Date;
}

export interface SupervisorCyclePayload {
  sessionId: string;
  runId: string;
  phase: OrchestrationPhase;
  success: boolean;
  durationMs: number;
  retries: number;
  timestamp: Date;
}

export interface SupervisorDecisionPayload {
  sessionId: string;
  runId: string;
  action: string;
  reason: string;
  phase: OrchestrationPhase;
  timestamp: Date;
}

export interface LoopDetectedPayload {
  sessionId: string;
  runId: string;
  risk: LoopRiskLevel;
  pattern: string;
  occurrences: number;
  timestamp: Date;
}

export interface EscalationPayload {
  sessionId: string;
  runId: string;
  reason: EscalationReason;
  phase: OrchestrationPhase;
  retryCount: number;
  timestamp: Date;
}

export interface SupervisorShutdownPayload {
  sessionId: string;
  status: SupervisorStatus;
  activeSessions: number;
  timestamp: Date;
}

export interface SupervisorEventMap {
  'supervisor.started':          SupervisorStartedPayload;
  'supervisor.cycle.started':    SupervisorCyclePayload;
  'supervisor.cycle.completed':  SupervisorCyclePayload;
  'supervisor.cycle.failed':     SupervisorCyclePayload;
  'supervisor.decision.made':    SupervisorDecisionPayload;
  'supervisor.loop.detected':    LoopDetectedPayload;
  'supervisor.escalated':        EscalationPayload;
  'supervisor.shutdown':         SupervisorShutdownPayload;
}

export type SupervisorEventName = keyof SupervisorEventMap;

export type { OrchestrationPhase, OrchestrationStatus, LifecyclePayload, FailurePayload };
