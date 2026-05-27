import { randomUUID } from 'crypto';
import type { AppType, PlanComplexity, PhaseType, TaskCategory, TaskPriority } from '../types/planner.types.ts';

export function generatePlanId(): string {
  return `plan_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export function generatePhaseId(type: PhaseType): string {
  return `phase_${type}_${randomUUID().slice(0, 6)}`;
}

export function generateTaskId(category: TaskCategory): string {
  return `task_${category}_${Date.now()}_${randomUUID().slice(0, 6)}`;
}

export function complexityToScore(complexity: PlanComplexity): number {
  const scores: Record<PlanComplexity, number> = { low: 25, medium: 55, high: 85 };
  return scores[complexity];
}

export function scoreToComplexity(score: number): PlanComplexity {
  if (score <= 35) return 'low';
  if (score <= 65) return 'medium';
  return 'high';
}

export function appTypeLabel(type: AppType): string {
  const labels: Record<AppType, string> = {
    crud:       'CRUD Application',
    saas:       'SaaS Platform',
    ai_app:     'AI-Powered App',
    ecommerce:  'E-Commerce Store',
    dashboard:  'Dashboard / Analytics',
    auth_system:'Auth System',
    backend_api:'Backend API',
  };
  return labels[type] ?? type;
}

export function estimatedMinutesForComplexity(
  complexity: PlanComplexity,
  taskCount: number,
): number {
  const perTask: Record<PlanComplexity, number> = { low: 5, medium: 10, high: 20 };
  return perTask[complexity] * taskCount;
}

export function priorityForPhase(phase: PhaseType): TaskPriority {
  const map: Record<PhaseType, TaskPriority> = {
    setup:        'critical',
    backend:      'high',
    frontend:     'normal',
    verification: 'high',
    deployment:   'normal',
  };
  return map[phase];
}

export function phaseOrder(phase: PhaseType): number {
  const order: Record<PhaseType, number> = {
    setup:        1,
    backend:      2,
    frontend:     3,
    verification: 4,
    deployment:   5,
  };
  return order[phase];
}

export function containsKeyword(goal: string, keywords: string[]): boolean {
  const lower = goal.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}
