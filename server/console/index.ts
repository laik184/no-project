/**
 * server/console/index.ts
 *
 * Public API surface for the console module.
 * All external imports from this module MUST use this file.
 * Never import from internal sub-paths directly.
 */

// ── Router (mount in main.ts) ─────────────────────────────────────────────────
export { consoleRouter } from './api/console-controller.ts';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
export { consoleService } from '../services/console/console-service.ts';

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

// ── Log ingestion (for agent/tool integration) ────────────────────────────────
export { logService }     from '../services/console/log-service.ts';
export { runtimeService } from '../services/console/runtime-service.ts';
