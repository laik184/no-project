/**
 * server/console/types/index.ts
 *
 * Canonical server-side console types.
 * Must stay in sync with client/src/types/console.ts.
 */

// ── Runtime States ─────────────────────────────────────────────────────────────

export type RuntimeState =
  | 'idle'
  | 'starting'
  | 'installing'
  | 'compiling'
  | 'ready'
  | 'restarting'
  | 'reconnecting'
  | 'crashed'
  | 'recovering'
  | 'recovered'
  | 'warning'
  | 'failed';

export const RUNTIME_STATES: RuntimeState[] = [
  'idle', 'starting', 'installing', 'compiling', 'ready',
  'restarting', 'reconnecting', 'crashed', 'recovering',
  'recovered', 'warning', 'failed',
];

export function isRuntimeState(v: unknown): v is RuntimeState {
  return typeof v === 'string' && RUNTIME_STATES.includes(v as RuntimeState);
}

// ── Log line metadata ──────────────────────────────────────────────────────────

export interface NpmMeta {
  type:             'install-start' | 'install-progress' | 'install-done' | 'install-warning' | 'install-error';
  packages?:        number;
  vulnerabilities?: number;
  packageName?:     string;
}

export interface ViteMeta {
  type:  'starting' | 'ready' | 'hmr' | 'compile-error' | 'build-start' | 'build-done';
  url?:  string;
  file?: string;
}

export interface NodeMeta {
  type:     'stack-trace' | 'uncaught' | 'unhandled' | 'startup-error' | 'syntax-error';
  file?:    string;
  line?:    number;
  column?:  number;
  message?: string;
}

export interface ConsoleLineMeta {
  npm?:  NpmMeta;
  vite?: ViteMeta;
  node?: NodeMeta;
}

// ── Log Line ───────────────────────────────────────────────────────────────────
// NOTE: wire format uses `line` (not `text`) — matches useConsoleStream.ts parser.

export type LogKind = 'stdout' | 'stderr' | 'system' | 'error';

export interface LogLine {
  id:   string;
  kind: LogKind;
  /** Raw text content of the log line */
  line: string;
  ts:   string;
  meta?: ConsoleLineMeta;
}

// ── SSE Event Payloads ─────────────────────────────────────────────────────────

export interface RuntimeStateEvent {
  type:    'runtime.state';
  state:   RuntimeState;
  prev:    RuntimeState;
  message: string;
  ts:      string;
}

export interface ConnectedEvent {
  type: 'connected';
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface ConsoleSession {
  sessionId:    string;
  projectId:    number;
  connectedAt:  number;
  lastHeartbeat: number;
  closed:       boolean;
}

// ── Runtime entry (in-memory) ─────────────────────────────────────────────────

export interface RuntimeEntry {
  projectId:    number;
  state:        RuntimeState;
  prev:         RuntimeState;
  message:      string;
  updatedAt:    number;
  heartbeatAt:  number;
}
