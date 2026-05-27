import type { OrchestrationPhase, TaskPriority } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode, GoalCategory } from './supervisor.types.ts';

export type AgentRole =
  | 'analyzer'
  | 'planner'
  | 'executor'
  | 'verifier'
  | 'browser'
  | 'supervisor';

export interface AgentDescriptor {
  role: AgentRole;
  phase: OrchestrationPhase;
  maxConcurrent: number;
  timeoutMs: number;
  retryable: boolean;
}

export interface RoutingDecision {
  taskId: string;
  runId: string;
  targetAgent: AgentRole;
  targetPhase: OrchestrationPhase;
  priority: TaskPriority;
  reason: string;
  scheduledAt: Date;
}

export interface PriorityRule {
  id: string;
  condition: (runId: string, phase: OrchestrationPhase, mode: ExecutionMode) => boolean;
  priority: TaskPriority;
  label: string;
}

export interface TaskRoute {
  taskId: string;
  runId: string;
  type: string;
  priority: TaskPriority;
  targetPhase: OrchestrationPhase;
  mode: ExecutionMode;
  category: GoalCategory;
  createdAt: Date;
}

export interface RouterStats {
  totalRouted: number;
  byPriority: Record<TaskPriority, number>;
  byPhase: Partial<Record<OrchestrationPhase, number>>;
  byAgent: Record<AgentRole, number>;
}

export const AGENT_REGISTRY: Record<OrchestrationPhase, AgentDescriptor> = {
  analyze:      { role: 'analyzer',   phase: 'analyze',      maxConcurrent: 3,  timeoutMs: 15_000,  retryable: true  },
  planning:     { role: 'planner',    phase: 'planning',     maxConcurrent: 2,  timeoutMs: 30_000,  retryable: true  },
  execution:    { role: 'executor',   phase: 'execution',    maxConcurrent: 1,  timeoutMs: 120_000, retryable: true  },
  verification: { role: 'verifier',   phase: 'verification', maxConcurrent: 2,  timeoutMs: 90_000,  retryable: true  },
  browser:      { role: 'browser',    phase: 'browser',      maxConcurrent: 1,  timeoutMs: 60_000,  retryable: false },
  complete:     { role: 'supervisor', phase: 'complete',     maxConcurrent: 1,  timeoutMs: 5_000,   retryable: false },
  failed:       { role: 'supervisor', phase: 'failed',       maxConcurrent: 1,  timeoutMs: 5_000,   retryable: false },
};
