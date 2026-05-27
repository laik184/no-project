import { randomBytes } from 'crypto';
import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { ExecutionMode, GoalCategory } from '../types/supervisor.types.ts';

export function generateSessionId(): string {
  return `sv_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

export function generateTaskId(runId: string, phase: OrchestrationPhase): string {
  return `${runId}:${phase}:${randomBytes(3).toString('hex')}`;
}

export function elapsed(since: Date): number {
  return Date.now() - since.getTime();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function modeLabel(mode: ExecutionMode): string {
  const labels: Record<ExecutionMode, string> = {
    simple:   'Simple (1–3 tasks)',
    standard: 'Standard (4–8 tasks)',
    complex:  'Complex (9+ tasks)',
  };
  return labels[mode];
}

export function categoryLabel(category: GoalCategory): string {
  const labels: Record<GoalCategory, string> = {
    crud:           'CRUD Application',
    saas_dashboard: 'SaaS Dashboard',
    ai_app:         'AI Application',
    auth_system:    'Auth System',
    backend_api:    'Backend API',
    database_ops:   'Database Operations',
    unknown:        'Unknown',
  };
  return labels[category];
}

export function phaseTimeout(phase: OrchestrationPhase, mode: ExecutionMode): number {
  const base: Partial<Record<OrchestrationPhase, number>> = {
    analyze:      15_000,
    planning:     30_000,
    execution:    120_000,
    verification: 90_000,
    browser:      60_000,
  };

  const multiplier = mode === 'complex' ? 2 : mode === 'standard' ? 1.5 : 1;
  return Math.round((base[phase] ?? 30_000) * multiplier);
}

export function isTerminalPhase(phase: OrchestrationPhase): boolean {
  return phase === 'complete' || phase === 'failed';
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function truncate(str: string, maxLen = 120): string {
  return str.length <= maxLen ? str : `${str.slice(0, maxLen)}…`;
}

export function safeJson(val: unknown): Record<string, unknown> {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}
