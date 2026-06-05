/**
 * server/services/console/index.ts
 * PUBLIC entry point for the console services layer.
 * External consumers MUST import only from this file — never from sub-paths.
 *
 * Dependency rule:
 *   Controller  → server/services/console/index.ts
 *   server/console/index.ts → server/services/console/index.ts
 *   NEVER: anything → server/services/console/<file>.ts directly
 */

// ── Service singletons ────────────────────────────────────────────────────────
export { consoleService }  from './console-service.ts';
export { logService }      from './log-service.ts';
export { runtimeService }  from './runtime-service.ts';
export { processService }  from './process-service.ts';

// ── Types re-exported for convenience ─────────────────────────────────────────
export type { ProcessStartOptions, ProcessInfo } from './process-service.ts';
export type { StartRuntimeOptions }              from './runtime-service.ts';
