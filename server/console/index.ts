/**
 * server/console/index.ts
 *
 * Public API surface for the console module.
 * All external imports from this module MUST use this file.
 * Never import from internal sub-paths directly.
 */

// ── Router (mount in main.ts) ─────────────────────────────────────────────────
export { consoleRouter } from './api/console-controller.ts';

// ── Services (via the services layer public entry point) ──────────────────────
export { consoleService, logService, runtimeService, processService } from '../services/console/index.ts';
export type { ProcessStartOptions, ProcessInfo, StartRuntimeOptions } from '../services/console/index.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  LogLine,
  LogKind,
  RuntimeState,
  RuntimeStateEvent,
  ConsoleLineMeta,
  NpmMeta,
  ViteMeta,
  NodeMeta,
  ConsoleSession,
  RuntimeEntry,
} from './types/index.ts';

// ── Event helpers (for agent/tool integration) ────────────────────────────────
export { emitLogLine, emitRuntimeState } from './events/console-events.ts';

