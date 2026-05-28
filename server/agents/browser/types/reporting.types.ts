/**
 * server/agents/browser/types/reporting.types.ts
 * Browser report and telemetry shapes.
 */

export interface ScreenshotMeta {
  label:      string;
  path:       string;
  runId:      string;
  sessionId:  string;
  fullPage:   boolean;
  capturedAt: string;
  sizeBytes?: number;
}

export interface ActionEntry {
  action:    string;
  tool:      string;
  ok:        boolean;
  durationMs: number;
  ts:        string;
  error?:    string;
}

export interface PerformanceSummary {
  ttfbMs:      number;
  loadMs:      number;
  domReadyMs:  number;
  resourceCount: number;
}

export interface BrowserReport {
  sessionId:   string;
  runId:       string;
  url:         string;
  ok:          boolean;
  screenshots: ScreenshotMeta[];
  actions:     ActionEntry[];
  performance?: PerformanceSummary;
  errors:      string[];
  durationMs:  number;
  createdAt:   string;
}
