import { plannerBus } from './planner-events.ts';
import { plannerLogger } from '../telemetry/planner-logger.ts';
import { plannerMetrics } from '../telemetry/planner-metrics.ts';

let handlersRegistered = false;

export function registerPlannerEventHandlers(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  plannerBus.on('planning.started', ({ runId, goal }) => {
    plannerLogger.info(runId, `Planning started`, { goal: goal.slice(0, 80) });
    plannerMetrics.recordPlanStarted(runId);
  });

  plannerBus.on('planning.phase.generated', ({ runId, phase, taskCount }) => {
    plannerLogger.info(runId, `Phase generated: ${phase}`, { taskCount });
  });

  plannerBus.on('planning.completed', ({ runId, durationMs }) => {
    plannerLogger.info(runId, `Planning completed`, { durationMs });
    plannerMetrics.recordPlanCompleted(runId, durationMs);
  });

  plannerBus.on('planning.failed', ({ runId, error, durationMs }) => {
    plannerLogger.error(runId, `Planning failed: ${error}`, { durationMs });
    plannerMetrics.recordPlanFailed(runId, durationMs);
  });
}

export function unregisterPlannerEventHandlers(): void {
  plannerBus.removeAllListeners();
  handlersRegistered = false;
}
