/**
 * server/browser/types.ts
 * Shared types for the browser intelligence system.
 * No logic, no imports from sibling modules.
 */

export type VisualStatus   = "ok" | "blank" | "partial" | "error";
export type HydrationStatus = "ok" | "failed" | "timeout" | "unknown";
export type InteractionStatus = "ok" | "failed" | "skipped";

export interface ConsoleError {
  level:   "error" | "warning";
  message: string;
  source?: string;
  count:   number;
}

export interface ResponsiveIssue {
  viewport:    string;
  description: string;
  severity:    "low" | "medium" | "high";
}

export interface DOMSnapshot {
  title:         string;
  url:           string;
  bodyText:      string; // first 500 chars
  elementCount:  number;
  hasMain:       boolean;
  hasNav:        boolean;
  visibleErrors: string[];
}

export interface BrowserValidationReport {
  runId:              string;
  projectId:          number;
  url:                string;
  visualStatus:       VisualStatus;
  hydrationStatus:    HydrationStatus;
  interactionStatus:  InteractionStatus;
  consoleErrors:      ConsoleError[];
  screenshotEvidence: string | null;  // base64 or file path
  domSnapshot:        DOMSnapshot | null;
  responsiveIssues:   ResponsiveIssue[];
  blocked:            boolean;
  blockReasons:       string[];
  elapsedMs:          number;
}

export interface BrowserSession {
  sessionId:  string;
  projectId:  number;
  port:       number;
  url:        string;
  startedAt:  number;
}

export interface ScreenshotAnalysis {
  isBlank:         boolean;
  hasContent:      boolean;
  hasErrorOverlay: boolean;
  confidence:      number;
  notes:           string[];
}
