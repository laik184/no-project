/**
 * navigation-events.ts
 * Emit helpers for navigation-lifecycle events via the browser local bus.
 */

import { EventEmitter } from 'events';

export interface NavigationEventMap {
  'navigation.started':    { runId: string; url: string; timestamp: Date };
  'navigation.completed':  { runId: string; url: string; durationMs: number; ok: boolean; timestamp: Date };
  'navigation.failed':     { runId: string; url: string; error: string; timestamp: Date };
  'flow.started':          { runId: string; flowName: string; stepsTotal: number; timestamp: Date };
  'flow.step.completed':   { runId: string; flowName: string; step: string; success: boolean; durationMs: number; timestamp: Date };
  'flow.completed':        { runId: string; flowName: string; ok: boolean; durationMs: number; timestamp: Date };
}

export type NavigationEventName = keyof NavigationEventMap;

class TypedNavigationEmitter extends EventEmitter {
  emit<K extends NavigationEventName>(event: K, payload: NavigationEventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends NavigationEventName>(event: K, listener: (p: NavigationEventMap[K]) => void): this {
    return super.on(event, listener);
  }
  off<K extends NavigationEventName>(event: K, listener: (p: NavigationEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const navigationBus = new TypedNavigationEmitter();
navigationBus.setMaxListeners(20);

export function emitNavigationStarted(runId: string, url: string): void {
  navigationBus.emit('navigation.started', { runId, url, timestamp: new Date() });
}

export function emitNavigationCompleted(
  runId: string, url: string, durationMs: number, ok: boolean,
): void {
  navigationBus.emit('navigation.completed', { runId, url, durationMs, ok, timestamp: new Date() });
}

export function emitNavigationFailed(runId: string, url: string, error: string): void {
  navigationBus.emit('navigation.failed', { runId, url, error, timestamp: new Date() });
}

export function emitFlowStarted(runId: string, flowName: string, stepsTotal: number): void {
  navigationBus.emit('flow.started', { runId, flowName, stepsTotal, timestamp: new Date() });
}

export function emitFlowStepCompleted(
  runId: string, flowName: string, step: string, success: boolean, durationMs: number,
): void {
  navigationBus.emit('flow.step.completed', { runId, flowName, step, success, durationMs, timestamp: new Date() });
}

export function emitFlowCompleted(runId: string, flowName: string, ok: boolean, durationMs: number): void {
  navigationBus.emit('flow.completed', { runId, flowName, ok, durationMs, timestamp: new Date() });
}
