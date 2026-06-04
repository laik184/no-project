/**
 * server/agents/browser/events/browser-events.ts
 *
 * Browser-local typed event emitter + convenience emit helpers.
 * Carries browser lifecycle events internally before they fan out
 * to the infrastructure bus via browser-bus-bridge.ts.
 */

import { EventEmitter } from 'events';

export interface BrowserLifecyclePayload {
  sessionId:       string;
  runId:           string;
  url?:            string;
  error?:          string;
  label?:          string;
  screenshotPath?: string;
  ts:              string;
}

export type BrowserEventType =
  | 'session.started'
  | 'session.closed'
  | 'session.crashed'
  | 'navigation.started'
  | 'navigation.completed'
  | 'navigation.failed'
  | 'screenshot.captured'
  | 'validation.passed'
  | 'validation.failed'
  | 'step.completed'
  | 'step.failed'
  | 'flow.completed'
  | 'flow.failed';

type BrowserEventMap = {
  [K in BrowserEventType]: (payload: BrowserLifecyclePayload) => void;
};

class BrowserEventEmitter extends EventEmitter {
  emit<K extends BrowserEventType>(
    event:   K,
    payload: BrowserLifecyclePayload,
  ): boolean {
    return super.emit(event as string, payload);
  }

  on<K extends BrowserEventType>(
    event:    K,
    listener: BrowserEventMap[K],
  ): this {
    return super.on(event as string, listener as (...args: unknown[]) => void);
  }

  off<K extends BrowserEventType>(
    event:    K,
    listener: BrowserEventMap[K],
  ): this {
    return super.off(event as string, listener as (...args: unknown[]) => void);
  }
}

export const browserBus = new BrowserEventEmitter();
browserBus.setMaxListeners(0);

// ── Emit helpers (used by tools layer) ────────────────────────────────────────

export function emitScreenshotCaptured(
  sessionId:      string,
  runId:          string,
  label:          string,
  screenshotPath: string,
): void {
  browserBus.emit('screenshot.captured', {
    sessionId, runId, label, screenshotPath, ts: new Date().toISOString(),
  });
}

export function emitBrowserCrashed(
  sessionId: string,
  runId:     string,
  error:     string,
): void {
  browserBus.emit('session.crashed', {
    sessionId, runId, error, ts: new Date().toISOString(),
  });
}

export function emitValidationPassed(sessionId: string, runId: string): void {
  browserBus.emit('validation.passed', {
    sessionId, runId, ts: new Date().toISOString(),
  });
}

export function emitValidationFailed(
  sessionId: string,
  runId:     string,
  error:     string,
): void {
  browserBus.emit('validation.failed', {
    sessionId, runId, error, ts: new Date().toISOString(),
  });
}

export function emitSessionStarted(sessionId: string, runId: string, url: string): void {
  browserBus.emit('session.started', {
    sessionId, runId, url, ts: new Date().toISOString(),
  });
}

export function emitSessionClosed(sessionId: string, runId: string): void {
  browserBus.emit('session.closed', {
    sessionId, runId, ts: new Date().toISOString(),
  });
}
