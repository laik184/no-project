/**
 * task-dispatcher.ts
 *
 * Merged from task-router.ts + priority-router.ts.
 * Responsibilities: priority resolution, task routing, queue dispatch, routing history.
 */

import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { TaskRoute, PriorityRule, TaskPriority } from '../types/routing.types.ts';
import type { ExecutionMode, GoalCategory } from '../types/supervisor.types.ts';
import { taskCoordinator } from '../coordination/task-coordinator.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';

// ── Priority resolution ────────────────────────────────────────────────────

const PHASE_PRIORITY: Partial<Record<OrchestrationPhase, TaskPriority>> = {
  analyze:      'high',
  planning:     'high',
  execution:    'normal',
  verification: 'high',
  browser:      'low',
  failed:       'critical',
};

const customRules: PriorityRule[] = [];

function resolvePriority(
  phase: OrchestrationPhase,
  mode: ExecutionMode,
  runId: string,
): TaskPriority {
  for (const rule of customRules) {
    if (rule.condition(runId, phase, mode)) return rule.priority;
  }
  if (mode === 'complex' && phase === 'execution') return 'high';
  return PHASE_PRIORITY[phase] ?? 'normal';
}

// ── Route history ──────────────────────────────────────────────────────────

const routeHistory = new Map<string, TaskRoute[]>();

function record(runId: string, route: TaskRoute): void {
  if (!routeHistory.has(runId)) routeHistory.set(runId, []);
  const hist = routeHistory.get(runId)!;
  hist.push(route);
  if (hist.length > 100) hist.shift();
}

// ── Public API ─────────────────────────────────────────────────────────────

interface DispatchSpec {
  runId:    string;
  phase:    OrchestrationPhase;
  type:     string;
  mode:     ExecutionMode;
  category: GoalCategory;
  input?:   Record<string, unknown>;
}

export const taskDispatcher = {
  dispatch(spec: DispatchSpec): TaskRoute {
    const priority = resolvePriority(spec.phase, spec.mode, spec.runId);

    const route: TaskRoute = {
      taskId:      `${spec.runId}:${spec.phase}:${Date.now()}`,
      runId:       spec.runId,
      type:        spec.type,
      priority,
      targetPhase: spec.phase,
      mode:        spec.mode,
      category:    spec.category,
      createdAt:   new Date(),
    };

    taskCoordinator.enqueue({
      runId:    spec.runId,
      phase:    spec.phase,
      type:     spec.type,
      priority,
      input:    spec.input ?? {},
      mode:     spec.mode,
    });

    record(spec.runId, route);

    supervisorLogger.info(
      spec.runId,
      `[task-dispatcher] Dispatched "${spec.type}" → phase="${spec.phase}" priority=${priority} mode=${spec.mode}`,
    );

    return route;
  },

  addRule(rule: PriorityRule): void {
    customRules.push(rule);
  },

  removeRule(ruleId: string): void {
    const idx = customRules.findIndex((r) => r.id === ruleId);
    if (idx !== -1) customRules.splice(idx, 1);
  },

  getRoutes(runId: string): TaskRoute[] {
    return routeHistory.get(runId) ?? [];
  },

  clearRun(runId: string): void {
    routeHistory.delete(runId);
  },
};
