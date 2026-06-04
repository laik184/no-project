/**
 * server/agents/browser/events/browser-event-publisher.ts
 *
 * Single point of infrastructure bus access for the browser agent layer.
 * Only this file may import the infrastructure bus — browser-bus-bridge.ts
 * calls publishBrowserSession() instead of touching bus directly.
 */
import { bus } from '../../../infrastructure/index.ts';

export interface BrowserSessionEvent {
  type:           'started' | 'closed' | 'crashed' | 'screenshot' | 'validation.passed' | 'validation.failed';
  sessionId:      string;
  runId:          string;
  url?:           string;
  label?:         string;
  screenshotPath?: string;
  error?:         string;
  timestamp:      string;
}

export function publishBrowserSession(event: BrowserSessionEvent): void {
  try {
    bus.emit('browser.session', event);
  } catch {
    // Never let publish errors propagate
  }
}
