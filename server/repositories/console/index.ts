/**
 * server/repositories/console/index.ts
 * PUBLIC entry point for the console repositories layer.
 * External consumers MUST import only from this file — never from sub-paths.
 *
 * Dependency rule:
 *   Services  → server/repositories/console/index.ts
 *   Domain    → server/repositories/console/index.ts
 *   NEVER: anything → server/repositories/console/<file>.ts directly
 */

// ── Singletons ────────────────────────────────────────────────────────────────
export { logRepository }        from './log-repository.ts';
export { sessionRepository }    from './session-repository.ts';
export { runtimeRepository }    from './runtime-repository.ts';
export { checkpointRepository } from './checkpoint-repository.ts';

// ── Interfaces ────────────────────────────────────────────────────────────────
export type { ILogRepository }        from './log-repository.ts';
export type { ISessionRepository }    from './session-repository.ts';
export type { IRuntimeRepository }    from './runtime-repository.ts';
export type { ICheckpointRepository } from './checkpoint-repository.ts';

// ── Value types ───────────────────────────────────────────────────────────────
export type { CheckpointSummary } from './checkpoint-repository.ts';
