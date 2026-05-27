/**
 * reporting.types.ts
 * Report structures for browser runs, validation, and performance.
 */

import type { ConsoleError }    from './validation.types.ts';
import type { FlowResult }       from './navigation.types.ts';

export interface ScreenshotMeta {
  id:         string;
  label:      string;
  path:       string;
  timestamp:  number;
  sizeBytes?: number;
}

export interface ActionEntry {
  action:     string;
  target?:    string;
  value?:     string;
  success:    boolean;
  durationMs: number;
  timestamp:  number;
}

export interface NavigationSummary {
  loaded:       boolean;
  httpStatus?:  number;
  loadTimeMs?:  number;
  title?:       string;
}

export interface ValidationSummary {
  passed:        number;
  failed:        number;
  crashDetected: boolean;
  consoleErrors: number;
}

export interface PerformanceSummary {
  loadTimeMs?:             number;
  renderTimeMs?:           number;
  interactionLatencyMs?:   number;
}

export interface BrowserReport {
  runId:         string;
  sessionId:     string;
  url:           string;
  ok:            boolean;
  navigation:    NavigationSummary;
  validation:    ValidationSummary;
  screenshots:   ScreenshotMeta[];
  consoleErrors: ConsoleError[];
  flows:         FlowResult[];
  performance:   PerformanceSummary;
  actions:       ActionEntry[];
  durationMs:    number;
  timestamp:     number;
  error?:        string;
}
