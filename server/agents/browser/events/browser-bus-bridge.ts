/**
 * browser-bus-bridge.ts
 * Bridges the internal browserBus (Playwright agent events) into the
 * global infrastructure bus so they fan-out through the SSE pool as
 * "browser.session" events.
 *
 * Call initBrowserBusBridge() once at server startup.
 */

import { browserBus }  from './browser-events.ts';
import { bus }         from '../../../infrastructure/events/bus.ts';

let initialized = false;

export function initBrowserBusBridge(): void {
  if (initialized) return;
  initialized = true;

  browserBus.on('browser.started', ({ sessionId, runId, timestamp }) => {
    bus.emit('browser.session', {
      type: 'started', sessionId, runId,
      timestamp: timestamp.toISOString(),
    });
  });

  browserBus.on('browser.closed', ({ sessionId, runId, timestamp }) => {
    bus.emit('browser.session', {
      type: 'closed', sessionId, runId,
      timestamp: timestamp.toISOString(),
    });
  });

  browserBus.on('browser.crashed', ({ sessionId, runId, error, timestamp }) => {
    bus.emit('browser.session', {
      type: 'crashed', sessionId, runId, error,
      timestamp: timestamp.toISOString(),
    });
  });

  browserBus.on('screenshot.captured', ({ sessionId, runId, label, path, timestamp }) => {
    bus.emit('browser.session', {
      type: 'screenshot', sessionId, runId, label,
      screenshotPath: path,
      timestamp: timestamp.toISOString(),
    });
  });

  browserBus.on('ui.validation.passed', ({ sessionId, runId, url, timestamp }) => {
    bus.emit('browser.session', {
      type: 'validation.passed', sessionId, runId, url,
      timestamp: timestamp.toISOString(),
    });
  });

  browserBus.on('ui.validation.failed', ({ sessionId, runId, url, reason, timestamp }) => {
    bus.emit('browser.session', {
      type: 'validation.failed', sessionId, runId, url, error: reason,
      timestamp: timestamp.toISOString(),
    });
  });
}
