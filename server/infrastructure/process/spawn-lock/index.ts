/**
 * server/infrastructure/process/spawn-lock/index.ts
 *
 * Public entry point for the spawn concurrency lock module.
 *
 * Only process-registry.ts should import from here.
 * All other runtime callers (runtimeManager, orchestrator, tools) are
 * automatically protected because they funnel through processRegistry.start().
 */

export { spawnLock }                  from "./spawn-lock.ts";
export type {
  SpawnLockEntry,
  SpawnLockEvent,
  SpawnLockTelemetryPayload,
}                                     from "./spawn-lock.types.ts";
