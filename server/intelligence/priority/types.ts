export type PriorityLevel = "critical" | "high" | "medium" | "low";

export interface TaskInput {
  readonly id: string;
  readonly label: string;
  readonly deadline?: number;
  readonly complexity?: number;
  readonly impact?: number;
  readonly dependencies?: readonly string[];
  readonly tags?: readonly string[];
  readonly createdAt?: number;
  readonly estimatedEffort?: number;
  readonly userFacing?: boolean;
  readonly systemCritical?: boolean;
}

export interface UrgencyScore {
  readonly taskId: string;
  readonly score: number;
  readonly isOverdue: boolean;
  readonly hoursUntilDeadline?: number;
  readonly reason: string;
}

export interface ImpactScore {
  readonly taskId: string;
  readonly score: number;
  readonly systemImpact: number;
  readonly userImpact: number;
  readonly riskLevel: number;
  readonly reason: string;
}

export interface DependencyWeight {
  readonly taskId: string;
  readonly weight: number;
  readonly blockingCount: number;
  readonly isBlocked: boolean;
  readonly reason: string;
}

export interface CombinedScore {
  readonly taskId: string;
  readonly score: number;
  readonly urgency: number;
  readonly impact: number;
  readonly dependency: number;
  readonly complexity: number;
}

export interface PriorityItem {
  readonly taskId: string;
  readonly score: number;
  readonly level: PriorityLevel;
  readonly reason: string;
}

export interface ConflictResolution {
  readonly taskId: string;
  readonly adjustedScore: number;
  readonly tieBreakApplied: boolean;
  readonly reason: string;
}

export interface PriorityResult {
  readonly success: boolean;
  readonly priorities: readonly PriorityItem[];
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface PriorityState {
  readonly tasks: readonly TaskInput[];
  readonly evaluated: readonly PriorityItem[];
  readonly priorityMap: Readonly<Record<string, PriorityItem>>;
  readonly timestamp: number;
}
