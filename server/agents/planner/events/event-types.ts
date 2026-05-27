import type { ExecutionPlan } from '../types/planner.types.ts';
import type { ValidationResult } from '../types/planning.types.ts';

export type PlannerEventName =
  | 'planning.started'
  | 'planning.phase.generated'
  | 'planning.completed'
  | 'planning.failed';

export interface PlanningStartedPayload {
  runId: string;
  goal: string;
  timestamp: Date;
}

export interface PlanningPhaseGeneratedPayload {
  runId: string;
  phase: string;
  taskCount: number;
  timestamp: Date;
}

export interface PlanningCompletedPayload {
  runId: string;
  plan: ExecutionPlan;
  durationMs: number;
  timestamp: Date;
}

export interface PlanningFailedPayload {
  runId: string;
  error: string;
  durationMs: number;
  timestamp: Date;
}

export interface PlannerEventMap {
  'planning.started': PlanningStartedPayload;
  'planning.phase.generated': PlanningPhaseGeneratedPayload;
  'planning.completed': PlanningCompletedPayload;
  'planning.failed': PlanningFailedPayload;
}
