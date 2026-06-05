/**
 * server/infrastructure/index.ts
 *
 * PUBLIC infrastructure API surface.
 *
 * All consumers should import from this file — not from internal sub-paths.
 * Internal modules (runtime-types.ts, atomic-write.util.ts) are intentionally
 * NOT exported here; they remain private implementation details.
 */

// ── Database ──────────────────────────────────────────────────────────────────
export { db } from './db/index.ts';

// ── Event Bus ─────────────────────────────────────────────────────────────────
export { bus } from './events/bus.ts';
export type { BusEventMap } from './events/bus.ts';

// ── File Change Events ────────────────────────────────────────────────────────
export { emitFileChange } from './events/file-change-emitter.ts';
export type { FileChangeEvent } from './events/file-change-emitter.ts';

// ── SSE Connection Pool ───────────────────────────────────────────────────────
export { sseManager } from './events/sse/sse-manager.ts';

// ── Process Observability (read-only facade) ──────────────────────────────────
export { processRegistry } from './process/process-registry.ts';

// ── Stream Topic Constants ────────────────────────────────────────────────────
export { TOPIC } from './realtime/stream-topics.ts';
export type { Topic } from './realtime/stream-topics.ts';

// ── Runtime Process Management ────────────────────────────────────────────────
export { runtimeManager } from './runtime/runtime-manager.ts';

// ── Sandbox Path Utilities ────────────────────────────────────────────────────
export { getProjectDir, getNuraDir } from './sandbox/sandbox.util.ts';

// ── Safe Filesystem Operations ────────────────────────────────────────────────
export { safeWriteFile, safeDeleteFile, safeBackup } from './checkpoints/safe-fs.util.ts';

// ── Git Operations ────────────────────────────────────────────────────────────
export { captureGitSha } from './checkpoints/git-runner.ts';

// ── Seed ──────────────────────────────────────────────────────────────────────
export { seedDefaultProject } from './seed.ts';

// ── Redis ─────────────────────────────────────────────────────────────────────
export { redis } from './redis/index.ts';
export type { RedisClient } from './redis/index.ts';

// ── Queue ─────────────────────────────────────────────────────────────────────
export { queue } from './queue/index.ts';
export type { IQueue, QueueJob } from './queue/index.ts';
