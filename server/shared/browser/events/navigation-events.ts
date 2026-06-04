/**
 * server/agents/browser/events/navigation-events.ts
 *
 * Typed emit helpers for navigation and flow lifecycle events.
 * Consumed by tools layer (page-navigator.ts, user-flow-runner.ts).
 */

import { browserBus } from './browser-events.ts';

// ── Navigation ────────────────────────────────────────────────────────────────

export function emitNavigationStarted(runId: string, url: string): void {
  browserBus.emit('navigation.started', {
    sessionId: runId,
    runId,
    url,
    ts: new Date().toISOString(),
  });
}

export function emitNavigationCompleted(
  runId:      string,
  url:        string,
  durationMs: number,
  ok:         boolean,
): void {
  browserBus.emit(ok ? 'navigation.completed' : 'navigation.failed', {
    sessionId: runId,
    runId,
    url,
    ts: new Date().toISOString(),
  });
}

export function emitNavigationFailed(
  runId:  string,
  url:    string,
  error:  string,
): void {
  browserBus.emit('navigation.failed', {
    sessionId: runId,
    runId,
    url,
    error,
    ts: new Date().toISOString(),
  });
}

// ── Flow lifecycle ────────────────────────────────────────────────────────────

export function emitFlowStarted(runId: string, flowName: string): void {
  browserBus.emit('step.completed', {
    sessionId: runId,
    runId,
    label: `flow.started:${flowName}`,
    ts:    new Date().toISOString(),
  });
}

export function emitFlowCompleted(
  runId:    string,
  flowName: string,
  ok:       boolean,
): void {
  browserBus.emit(ok ? 'flow.completed' : 'flow.failed', {
    sessionId: runId,
    runId,
    label: flowName,
    ts:    new Date().toISOString(),
  });
}

export function emitFlowStepCompleted(
  runId:    string,
  flowName: string,
  stepIdx:  number,
  ok:       boolean,
): void {
  browserBus.emit(ok ? 'step.completed' : 'step.failed', {
    sessionId: runId,
    runId,
    label: `${flowName}[${stepIdx}]`,
    ts:    new Date().toISOString(),
  });
}
