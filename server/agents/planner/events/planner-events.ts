import { EventEmitter } from 'events';
import type { PlannerEventMap, PlannerEventName } from './event-types.ts';
import type { ExecutionPlan } from '../types/planner.types.ts';

class TypedPlannerEmitter extends EventEmitter {
  emit<K extends PlannerEventName>(event: K, payload: PlannerEventMap[K]): boolean {
    return super.emit(event, payload);
  }

  on<K extends PlannerEventName>(
    event: K,
    listener: (payload: PlannerEventMap[K]) => void,
  ): this {
    return super.on(event, listener);
  }

  once<K extends PlannerEventName>(
    event: K,
    listener: (payload: PlannerEventMap[K]) => void,
  ): this {
    return super.once(event, listener);
  }

  off<K extends PlannerEventName>(
    event: K,
    listener: (payload: PlannerEventMap[K]) => void,
  ): this {
    return super.off(event, listener);
  }
}

export const plannerBus = new TypedPlannerEmitter();
plannerBus.setMaxListeners(20);

export function emitPlanningStarted(runId: string, goal: string): void {
  plannerBus.emit('planning.started', { runId, goal, timestamp: new Date() });
}

export function emitPlanningPhaseGenerated(
  runId: string,
  phase: string,
  taskCount: number,
): void {
  plannerBus.emit('planning.phase.generated', {
    runId,
    phase,
    taskCount,
    timestamp: new Date(),
  });
}

export function emitPlanningCompleted(
  runId: string,
  plan: ExecutionPlan,
  durationMs: number,
): void {
  plannerBus.emit('planning.completed', { runId, plan, durationMs, timestamp: new Date() });
}

export function emitPlanningFailed(
  runId: string,
  error: string,
  durationMs: number,
): void {
  plannerBus.emit('planning.failed', { runId, error, durationMs, timestamp: new Date() });
}
