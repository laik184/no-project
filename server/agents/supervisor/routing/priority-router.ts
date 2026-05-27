import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { TaskPriority, PriorityRule, RouterStats } from '../types/routing.types.ts';
import type { ExecutionMode } from '../types/supervisor.types.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';

const PHASE_PRIORITY: Partial<Record<OrchestrationPhase, TaskPriority>> = {
  analyze:      'high',
  planning:     'high',
  execution:    'normal',
  verification: 'high',
  browser:      'low',
  failed:       'critical',
};

const customRules: PriorityRule[] = [];

const stats: RouterStats = {
  totalRouted: 0,
  byPriority:  { critical: 0, high: 0, normal: 0, low: 0 },
  byPhase:     {},
  byAgent:     { analyzer: 0, planner: 0, executor: 0, verifier: 0, browser: 0, supervisor: 0 },
};

export const priorityRouter = {
  resolve(phase: OrchestrationPhase, mode: ExecutionMode, runId: string): TaskPriority {
    // Custom rules first
    for (const rule of customRules) {
      if (rule.condition(runId, phase, mode)) {
        this._trackStats(phase, rule.priority);
        return rule.priority;
      }
    }

    // Mode override for complex execution
    if (mode === 'complex' && phase === 'execution') {
      this._trackStats(phase, 'high');
      supervisorMetrics.increment(runId, 'supervisor.priority.boosted');
      return 'high';
    }

    const priority = PHASE_PRIORITY[phase] ?? 'normal';
    this._trackStats(phase, priority);
    return priority;
  },

  addRule(rule: PriorityRule): void {
    customRules.push(rule);
  },

  removeRule(ruleId: string): void {
    const idx = customRules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) customRules.splice(idx, 1);
  },

  getStats(): Readonly<RouterStats> {
    return { ...stats };
  },

  resetStats(): void {
    stats.totalRouted = 0;
    stats.byPriority = { critical: 0, high: 0, normal: 0, low: 0 };
    stats.byPhase = {};
  },

  _trackStats(phase: OrchestrationPhase, priority: TaskPriority): void {
    stats.totalRouted++;
    stats.byPriority[priority]++;
    stats.byPhase[phase] = (stats.byPhase[phase] ?? 0) + 1;
  },
};
