/**
 * browser.types.ts
 * Core browser session and capability type definitions.
 */

export type BrowserSessionStatus =
  | 'idle'
  | 'launching'
  | 'ready'
  | 'closing'
  | 'closed'
  | 'crashed';

export interface BrowserLaunchOptions {
  headless?: boolean;
  timeoutMs?: number;
  allowedHosts?: string[];
  executablePath?: string;
}

export interface BrowserSession {
  sessionId:  string;
  runId:      string;
  projectId?: number;
  status:     BrowserSessionStatus;
  launchedAt?: Date;
  closedAt?:   Date;
  pagesOpen:   number;
}

export interface BrowserCapabilities {
  screenshots:  boolean;
  navigation:   boolean;
  interaction:  boolean;
  validation:   boolean;
}

export interface BrowserHealthStatus {
  alive:       boolean;
  sessionId:   string;
  status:      BrowserSessionStatus;
  pagesOpen:   number;
  checkedAt:   number;
  error?:      string;
}
