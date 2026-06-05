/**
 * server/repositories/terminal/index.ts
 *
 * PUBLIC entry point for the terminal repositories layer.
 * External consumers MUST import only from this file — never from sub-paths.
 *
 * Dependency rule:
 *   Services  → server/repositories/terminal/index.ts
 *   Domain    → server/repositories/terminal/index.ts
 *   NEVER: anything → server/repositories/terminal/<file>.ts directly
 */

// ── Singletons ────────────────────────────────────────────────────────────────
export { terminalSessionRepository } from './terminal-session-repository.ts';
export { commandRepository }         from './command-repository.ts';
export { runtimeRepository }         from './runtime-repository.ts';
export { processRepository }         from './process-repository.ts';
export { terminalLogRepository }     from './terminal-log-repository.ts';
export { packageRepository }         from './package-repository.ts';
export { checkpointRepository }      from './checkpoint-repository.ts';

// ── Interfaces ────────────────────────────────────────────────────────────────
export type { ITerminalSessionRepository } from './terminal-session-repository.ts';
export type { ICommandRepository }         from './command-repository.ts';
export type { IRuntimeRepository }         from './runtime-repository.ts';
export type { IProcessRepository }         from './process-repository.ts';
export type { ITerminalLogRepository }     from './terminal-log-repository.ts';
export type { IPackageRepository }         from './package-repository.ts';
export type { ICheckpointRepository }      from './checkpoint-repository.ts';

// ── Value types ───────────────────────────────────────────────────────────────
export type { ProcessEntry }      from './process-repository.ts';
export type { PackageRecord }     from './package-repository.ts';
export type { CheckpointSummary } from './checkpoint-repository.ts';
