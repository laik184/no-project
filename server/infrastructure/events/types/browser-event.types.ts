/**
 * browser-event.types.ts — payload for "browser.session" bus events.
 */

export interface BrowserSessionEvent {
  type:
    | 'started'
    | 'closed'
    | 'crashed'
    | 'screenshot'
    | 'validation.passed'
    | 'validation.failed';
  sessionId:      string;
  runId:          string;
  projectId?:     number;
  label?:         string;
  screenshotPath?: string;
  error?:         string;
  url?:           string;
  timestamp:      string;
}
