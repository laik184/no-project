/**
 * server/terminal/index.ts
 *
 * Public API surface for the terminal module.
 * main.ts imports only from this file.
 */

// ── Router ────────────────────────────────────────────────────────────────────
export { terminalRouter } from './api/terminal-routes.ts';

// ── Runtime management ────────────────────────────────────────────────────────
export { terminalSessionManager } from './runtime/terminal-session-manager.ts';
export { terminalLifecycle }      from './runtime/terminal-lifecycle.ts';
export { terminalHealthMonitor }  from './runtime/terminal-health-monitor.ts';
export { spawnSupervised }        from './runtime/process-supervisor.ts';
export type { SupervisorHandle }  from './runtime/process-supervisor.ts';

// ── Streaming ─────────────────────────────────────────────────────────────────
export { terminalSseManager }     from './streaming/terminal-sse-manager.ts';
export { terminalStreamBroker }   from './streaming/terminal-stream-broker.ts';
export { connectionPool }         from './streaming/connection-pool.ts';

// ── Parsers ───────────────────────────────────────────────────────────────────
export { ansiParser }        from './parsers/ansi-parser.ts';
export { shellOutputParser } from './parsers/shell-output-parser.ts';
export { npmParser }         from './parsers/npm-parser.ts';
export { pnpmParser }        from './parsers/pnpm-parser.ts';
export { yarnParser }        from './parsers/yarn-parser.ts';
export { errorParser }       from './parsers/error-parser.ts';

// ── Events ────────────────────────────────────────────────────────────────────
export {
  TERMINAL_EVENT,
  makeLineFrame,
  makeExitFrame,
  makeSystemFrame,
  makeErrorFrame,
} from './events/terminal-events.ts';
export type { TerminalEventName } from './events/terminal-events.ts';

// ── Persistence ───────────────────────────────────────────────────────────────
export { terminalLogStore }     from './persistence/postgres/terminal-log-store.ts';
export { terminalSessionStore } from './persistence/postgres/terminal-session-store.ts';
export { terminalCacheStore }   from './persistence/redis/terminal-cache-store.ts';
export { terminalHistoryStore } from './persistence/file/terminal-history-store.ts';

// ── Contracts ─────────────────────────────────────────────────────────────────
export type {
  CommandInput,
  PackageInput,
  RuntimeInput,
  SessionCreateInput,
  HistoryInput,
} from './contracts/command-input.ts';

export type {
  CommandResult,
  PackageResult,
  RuntimeResult,
  SessionResult,
  HistoryResult,
} from './contracts/command-result.ts';

export type {
  SessionStatus,
  RuntimeStatus,
  LogSource,
  LogLevel,
  TerminalState,
  StreamFrame,
} from './contracts/terminal-state.ts';

// ── Domain ────────────────────────────────────────────────────────────────────
export type { TerminalSession } from './domain/entities/terminal-session.ts';
export type { TerminalCommand } from './domain/entities/terminal-command.ts';
export type { TerminalLog }     from './domain/entities/terminal-log.ts';
