/**
 * memory-cleaner.ts
 *
 * Periodic cleanup of low-quality, stale, or duplicate memories.
 * Runs on a scheduled interval — does NOT block the main execution path.
 */

import { pool }         from "../../infrastructure/db/index.ts";
import { deleteMemory } from "./pgvector-store.ts";
import type { MemoryCategory } from "../vector/vector-types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_MEMORIES_PER_PROJECT = 1_000;
const MAX_MEMORIES_GLOBAL      = 5_000;
const CLEANUP_INTERVAL_MS      = 6 * 60 * 60 * 1000;   // 6 hours

/** Max age in days before a memory is eligible for pruning. */
const PRUNE_AGE_DAYS: Record<MemoryCategory, number> = {
  pattern:       180,
  fact:           90,
  preference:    365,
  failure:        60,
  success:       120,
  architecture:  365,
  dependency:     30,
  runtime:        14,
};

// ── Prune strategies ──────────────────────────────────────────────────────────

async function pruneByAge(): Promise<number> {
  const client = await pool.connect();
  try {
    let deleted = 0;
    for (const [category, maxDays] of Object.entries(PRUNE_AGE_DAYS)) {
      const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
      const res = await client.query(
        `DELETE FROM nura_memories
         WHERE category = $1 AND last_used_at < $2 AND used_count < 2
         RETURNING id`,
        [category, cutoff],
      );
      deleted += res.rowCount ?? 0;
    }
    return deleted;
  } finally {
    client.release();
  }
}

async function pruneByCount(): Promise<number> {
  const client = await pool.connect();
  try {
    // Delete oldest low-score memories beyond global cap
    const res = await client.query(
      `DELETE FROM nura_memories
       WHERE id IN (
         SELECT id FROM nura_memories
         ORDER BY score ASC, last_used_at ASC
         LIMIT GREATEST(0, (SELECT COUNT(*) FROM nura_memories) - $1)
       )
       RETURNING id`,
      [MAX_MEMORIES_GLOBAL],
    );
    return res.rowCount ?? 0;
  } finally {
    client.release();
  }
}

async function pruneByProjectCount(): Promise<number> {
  const client = await pool.connect();
  try {
    // Per-project cap: keep top memories by score + recency
    const projectsRes = await client.query(
      "SELECT DISTINCT project_id FROM nura_memories WHERE project_id IS NOT NULL",
    );

    let deleted = 0;
    for (const row of projectsRes.rows) {
      const pid = row.project_id as number;
      const countRes = await client.query(
        "SELECT COUNT(*) AS cnt FROM nura_memories WHERE project_id = $1",
        [pid],
      );
      const cnt = Number(countRes.rows[0].cnt);

      if (cnt > MAX_MEMORIES_PER_PROJECT) {
        const excess = cnt - MAX_MEMORIES_PER_PROJECT;
        const res = await client.query(
          `DELETE FROM nura_memories
           WHERE project_id = $1 AND id IN (
             SELECT id FROM nura_memories WHERE project_id = $1
             ORDER BY score ASC, last_used_at ASC
             LIMIT $2
           )
           RETURNING id`,
          [pid, excess],
        );
        deleted += res.rowCount ?? 0;
      }
    }
    return deleted;
  } finally {
    client.release();
  }
}

// ── Low-score pruner ─────────────────────────────────────────────────────────

async function pruneLowScore(): Promise<number> {
  const res = await pool.query(
    "DELETE FROM nura_memories WHERE score < 0.2 AND used_count = 0 RETURNING id",
  );
  return res.rowCount ?? 0;
}

// ── Main cleanup runner ───────────────────────────────────────────────────────

export interface CleanupResult {
  byAge:      number;
  byCount:    number;
  byProject:  number;
  byScore:    number;
  total:      number;
  durationMs: number;
}

export async function runCleanup(): Promise<CleanupResult> {
  const t0 = Date.now();
  console.log("[memory-cleaner] Starting cleanup pass");

  const [byAge, byCount, byProject, byScore] = await Promise.all([
    pruneByAge().catch(() => 0),
    pruneByCount().catch(() => 0),
    pruneByProjectCount().catch(() => 0),
    pruneLowScore().catch(() => 0),
  ]);

  const total = byAge + byCount + byProject + byScore;
  const result: CleanupResult = { byAge, byCount, byProject, byScore, total, durationMs: Date.now() - t0 };

  console.log(`[memory-cleaner] Removed ${total} memories (age=${byAge}, count=${byCount}, project=${byProject}, score=${byScore}) in ${result.durationMs}ms`);
  return result;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

let _cleanupTimer: NodeJS.Timeout | null = null;

export function startCleanupScheduler(): void {
  if (_cleanupTimer) return;

  _cleanupTimer = setInterval(() => {
    runCleanup().catch(err =>
      console.error("[memory-cleaner] Cleanup failed:", err),
    );
  }, CLEANUP_INTERVAL_MS);

  _cleanupTimer.unref();
  console.log(`[memory-cleaner] Scheduler started (every ${CLEANUP_INTERVAL_MS / 3600000}h)`);
}

export function stopCleanupScheduler(): void {
  if (_cleanupTimer) {
    clearInterval(_cleanupTimer);
    _cleanupTimer = null;
  }
}
