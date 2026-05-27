/**
 * browser-events.ts
 * Typed local EventEmitter for browser-agent-internal events.
 * Also provides emit-helper functions for each event type.
 */

import { EventEmitter } from 'events';

export interface BrowserEventMap {
  'browser.started':          { sessionId: string; runId: string; timestamp: Date };
  'browser.closed':           { sessionId: string; runId: string; timestamp: Date };
  'browser.crashed':          { sessionId: string; runId: string; error: string; timestamp: Date };
  'screenshot.captured':      { sessionId: string; runId: string; label: string; path: string; timestamp: Date };
  'ui.validation.failed':     { sessionId: string; runId: string; url: string; reason: string; timestamp: Date };
  'ui.validation.passed':     { sessionId: string; runId: string; url: string; timestamp: Date };
}

export type BrowserEventName = keyof BrowserEventMap;

class TypedBrowserEmitter extends EventEmitter {
  emit<K extends BrowserEventName>(event: K, payload: BrowserEventMap[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends BrowserEventName>(event: K, listener: (p: BrowserEventMap[K]) => void): this {
    return super.on(event, listener);
  }
  once<K extends BrowserEventName>(event: K, listener: (p: BrowserEventMap[K]) => void): this {
    return super.once(event, listener);
  }
  off<K extends BrowserEventName>(event: K, listener: (p: BrowserEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const browserBus = new TypedBrowserEmitter();
browserBus.setMaxListeners(30);

export function emitBrowserStarted(sessionId: string, runId: string): void {
  browserBus.emit('browser.started', { sessionId, runId, timestamp: new Date() });
}

export function emitBrowserClosed(sessionId: string, runId: string): void {
  browserBus.emit('browser.closed', { sessionId, runId, timestamp: new Date() });
}

export function emitBrowserCrashed(sessionId: string, runId: string, error: string): void {
  browserBus.emit('browser.crashed', { sessionId, runId, error, timestamp: new Date() });
}

export function emitScreenshotCaptured(
  sessionId: string, runId: string, label: string, path: string,
): void {
  browserBus.emit('screenshot.captured', { sessionId, runId, label, path, timestamp: new Date() });
}

export function emitValidationFailed(
  sessionId: string, runId: string, url: string, reason: string,
): void {
  browserBus.emit('ui.validation.failed', { sessionId, runId, url, reason, timestamp: new Date() });
}

export function emitValidationPassed(sessionId: string, runId: string, url: string): void {
  browserBus.emit('ui.validation.passed', { sessionId, runId, url, timestamp: new Date() });
}
