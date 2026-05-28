/**
 * server/agents/browser/types/browser.types.ts
 * Core browser session and lifecycle types.
 */

export type BrowserSessionStatus =
  | 'launching'
  | 'active'
  | 'idle'
  | 'closed'
  | 'crashed';

export interface BrowserSession {
  sessionId:  string;
  runId:      string;
  projectId?: number;
  status:     BrowserSessionStatus;
  pagesOpen:  number;
  launchedAt?: Date;
  closedAt?:   Date;
  url?:        string;
  error?:      string;
}

export interface BrowserLaunchOptions {
  headless?:   boolean;
  timeoutMs?:  number;
  viewport?:   { width: number; height: number };
  projectId?:  number;
}

export interface BrowserHealthStatus {
  alive:     boolean;
  sessionId: string | null;
  url?:      string;
  reason?:   string;
}
