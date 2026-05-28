/**
 * server/agents/browser/events/interaction-events.ts
 *
 * Typed emit helpers for DOM interaction outcomes.
 * Consumed by tools layer (dom-interactor.ts, element-finder.ts).
 */

import { browserBus } from './browser-events.ts';

// ── Click ─────────────────────────────────────────────────────────────────────

export function emitClickResult(
  sessionId:  string,
  runId:      string,
  selector:   string,
  success:    boolean,
  durationMs: number,
): void {
  browserBus.emit(success ? 'step.completed' : 'step.failed', {
    sessionId,
    runId,
    label:     `click:${selector.slice(0, 60)}`,
    error:     success ? undefined : `click failed on ${selector}`,
    ts:        new Date().toISOString(),
  });
}

// ── Fill ──────────────────────────────────────────────────────────────────────

export function emitFillResult(
  sessionId:  string,
  runId:      string,
  selector:   string,
  success:    boolean,
  durationMs: number,
): void {
  browserBus.emit(success ? 'step.completed' : 'step.failed', {
    sessionId,
    runId,
    label:     `fill:${selector.slice(0, 60)}`,
    error:     success ? undefined : `fill failed on ${selector}`,
    ts:        new Date().toISOString(),
  });
}

// ── Select ────────────────────────────────────────────────────────────────────

export function emitSelectResult(
  sessionId:  string,
  runId:      string,
  selector:   string,
  success:    boolean,
  durationMs: number,
): void {
  browserBus.emit(success ? 'step.completed' : 'step.failed', {
    sessionId,
    runId,
    label:     `select:${selector.slice(0, 60)}`,
    error:     success ? undefined : `select failed on ${selector}`,
    ts:        new Date().toISOString(),
  });
}

// ── Interaction failed ────────────────────────────────────────────────────────

export function emitInteractionFailed(
  sessionId: string,
  runId:     string,
  action:    string,
  selector:  string,
  error:     string,
): void {
  browserBus.emit('step.failed', {
    sessionId,
    runId,
    label: `${action}:${selector.slice(0, 60)}`,
    error,
    ts:    new Date().toISOString(),
  });
}

// ── Element not found ─────────────────────────────────────────────────────────

export function emitElementNotFound(
  sessionId: string,
  runId:     string,
  selector:  string,
): void {
  browserBus.emit('step.failed', {
    sessionId,
    runId,
    label: `element-not-found:${selector.slice(0, 60)}`,
    error: `Element not found: ${selector}`,
    ts:    new Date().toISOString(),
  });
}
