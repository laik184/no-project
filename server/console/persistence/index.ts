/**
 * server/console/persistence/index.ts
 *
 * PUBLIC API for the console persistence layer.
 * Repositories import from here — never from sub-paths directly.
 *
 * Dependency rule:
 *   Repository → Persistence → Infrastructure
 */

// ── PostgreSQL stores ─────────────────────────────────────────────────────────
export { postgresLogStore }        from './postgres/postgres-log-store.ts';
export { postgresCheckpointStore } from './postgres/postgres-checkpoint-store.ts';
export { postgresSessionStore }    from './postgres/postgres-session-store.ts';
export { postgresRuntimeStore }    from './postgres/postgres-runtime-store.ts';

// ── Redis caches ──────────────────────────────────────────────────────────────
export { redisLogCache }     from './redis/redis-log-cache.ts';
export { redisRuntimeCache } from './redis/redis-runtime-cache.ts';

// ── File stores ───────────────────────────────────────────────────────────────
export { fileLogStore }        from './file/file-log-store.ts';
export { fileCheckpointStore } from './file/file-checkpoint-store.ts';

// ── Value types ───────────────────────────────────────────────────────────────
export type { CheckpointSummary } from './postgres/postgres-checkpoint-store.ts';
