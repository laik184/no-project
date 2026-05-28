/**
 * server/agents/browser/events/browser-bus-bridge.ts
 *
 * Bridges browser-local events into the infrastructure bus.
 * Called once at startup by main.ts via initBrowserBusBridge().
 * Converts BrowserLifecyclePayload → BrowserSessionEvent for the bus.
 */

import { bus }           from '../../../infrastructure/events/bus.ts';
import { browserBus }    from './browser-events.ts';
import type { BrowserLifecyclePayload } from './browser-events.ts';

// ── Mapping helpers ───────────────────────────────────────────────────────────

function toBusType(
  ev: string,
): 'started' | 'closed' | 'crashed' | 'screenshot' | 'validation.passed' | 'validation.failed' {
  if (ev === 'session.started')    return 'started';
  if (ev === 'session.closed')     return 'closed';
  if (ev === 'session.crashed')    return 'crashed';
  if (ev === 'screenshot.captured') return 'screenshot';
  if (ev === 'validation.passed')  return 'validation.passed';
  if (ev === 'validation.failed')  return 'validation.failed';
  return 'started';
}

function forward(
  evType: string,
  payload: BrowserLifecyclePayload,
): void {
  try {
    bus.emit('browser.session', {
      type:            toBusType(evType),
      sessionId:       payload.sessionId,
      runId:           payload.runId,
      url:             payload.url,
      label:           payload.label,
      screenshotPath:  payload.screenshotPath,
      error:           payload.error,
      timestamp:       payload.ts,
    });
  } catch {
    // Never let bridge errors propagate into the emitter
  }
}

// ── Wire-up ───────────────────────────────────────────────────────────────────

let _initialized = false;

export function initBrowserBusBridge(): void {
  if (_initialized) return;
  _initialized = true;

  const bridged: Array<Parameters<typeof browserBus.on>[0]> = [
    'session.started',
    'session.closed',
    'session.crashed',
    'screenshot.captured',
    'validation.passed',
    'validation.failed',
  ];

  for (const evType of bridged) {
    browserBus.on(evType, (payload: BrowserLifecyclePayload) => {
      forward(evType, payload);
    });
  }

  console.log('[browser-bus-bridge] Wired — 6 browser event types bridged to infrastructure bus.');
}
