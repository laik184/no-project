import type { OrchestrationPhase } from '../../../orchestration/events/event-types.ts';
import type { TaskRoute } from '../types/routing.types.ts';
import type { ExecutionMode, GoalCategory } from '../types/supervisor.types.ts';
import { taskCoordinator } from '../coordination/task-coordinator.ts';
import { priorityRouter } from './priority-router.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';

interface RouteSpec {
  runId: string;
  phase: OrchestrationPhase;
  type: string;
  mode: ExecutionMode;
  category: GoalCategory;
  input?: Record<string, unknown>;
}

const routeHistory = new Map<string, TaskRoute[]>();

export const taskRouter = {
  route(spec: RouteSpec): TaskRoute {
    const priority = priorityRouter.resolve(spec.phase, spec.mode, spec.runId);

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

    this._record(spec.runId, route);

    supervisorLogger.info(
      spec.runId,
      `[task-router] Routed "${spec.type}" → phase="${spec.phase}" priority=${priority} mode=${spec.mode}`,
    );
    supervisorMetrics.increment(spec.runId, `supervisor.tasks.routed.${spec.phase}`);

    return route;
  },

  getRoutes(runId: string): TaskRoute[] {
    return routeHistory.get(runId) ?? [];
  },

  clearRun(runId: string): void {
    routeHistory.delete(runId);
  },

  _record(runId: string, route: TaskRoute): void {
    if (!routeHistory.has(runId)) routeHistory.set(runId, []);
    const hist = routeHistory.get(runId)!;
    hist.push(route);
    if (hist.length > 100) hist.shift();
  },
};
