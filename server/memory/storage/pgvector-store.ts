/**
 * pgvector-store.ts
 *
 * PostgreSQL + pgvector persistence layer for semantic memory.
 * Gracefully degrades to JSON storage if pgvector extension is unavailable.
 */

import { pool } from "../../infrastructure/db/index.ts";
import { generateEmbedding } from "../vector/embedding-engine.ts";
import { EMBEDDING_DIM } from "../vector/vector-types.ts";
import type { MemoryEntry, MemoryCategory, VectorStoreStats } from "../vector/vector-types.ts";

let _pgvectorAvailable: boolean | null = null;

// ── Schema init ───────────────────────────────────────────────────────────────

export async function initVectorStore(): Promise<void> {
  const client = await pool.connect();
  try {
    // Try to enable pgvector
    try {
      await client.query("CREATE EXTENSION IF NOT EXISTS vector");
      _pgvectorAvailable = true;
      console.log("[pgvector-store] pgvector extension enabled");
    } catch {
      _pgvectorAvailable = false;
      console.warn("[pgvector-store] pgvector unavailable — storing embeddings as JSONB");
    }

    if (_pgvectorAvailable) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS nura_memories (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  INTEGER,
          category    TEXT NOT NULL,
          content     TEXT NOT NULL,
          context     TEXT,
          tags        TEXT[] DEFAULT '{}',
          score       REAL DEFAULT 1.0,
          used_count  INTEGER DEFAULT 0,
          embedding   vector(${EMBEDDING_DIM}),
          created_at  BIGINT NOT NULL,
          last_used_at BIGINT NOT NULL
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS nura_memories_embedding_idx
        ON nura_memories USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
      `).catch(() => { /* Index may already exist or IVFFlat requires more rows */ });
    } else {
      await client.query(`
        CREATE TABLE IF NOT EXISTS nura_memories (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id  INTEGER,
          category    TEXT NOT NULL,
          content     TEXT NOT NULL,
          context     TEXT,
          tags        TEXT[] DEFAULT '{}',
          score       REAL DEFAULT 1.0,
          used_count  INTEGER DEFAULT 0,
          embedding   JSONB,
          created_at  BIGINT NOT NULL,
          last_used_at BIGINT NOT NULL
        )
      `);
    }

    await client.query(`
      CREATE INDEX IF NOT EXISTS nura_memories_project_idx
      ON nura_memories (project_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS nura_memories_category_idx
      ON nura_memories (category)
    `);

    console.log("[pgvector-store] Schema ready");
  } finally {
    client.release();
  }
}

// ── Row → MemoryEntry ─────────────────────────────────────────────────────────

function rowToEntry(row: Record<string, unknown>): MemoryEntry {
  let embedding: number[] | undefined;
  if (row.embedding) {
    try {
      embedding = typeof row.embedding === "string"
        ? JSON.parse(row.embedding)
        : (row.embedding as number[]);
    } catch { /* ignore */ }
  }

  return {
    id:          row.id as string,
    projectId:   row.project_id as number | undefined,
    category:    row.category as MemoryCategory,
    content:     row.content as string,
    context:     row.context as string | undefined,
    tags:        (row.tags as string[]) ?? [],
    score:       (row.score as number) ?? 1.0,
    usedCount:   (row.used_count as number) ?? 0,
    createdAt:   row.created_at as number,
    lastUsedAt:  row.last_used_at as number,
    embedding,
  };
}

// ── Write operations ──────────────────────────────────────────────────────────

export async function storeMemory(entry: MemoryEntry): Promise<string> {
  const now        = Date.now();
  const embedding  = entry.embedding ?? (await generateEmbedding(entry.content)).embedding;
  const embeddingStr = _pgvectorAvailable
    ? `[${embedding.join(",")}]`
    : JSON.stringify(embedding);

  const res = await pool.query(
    `INSERT INTO nura_memories
      (project_id, category, content, context, tags, score, used_count, embedding, created_at, last_used_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id`,
    [
      entry.projectId ?? null,
      entry.category,
      entry.content,
      entry.context ?? null,
      entry.tags,
      entry.score,
      entry.usedCount,
      embeddingStr,
      entry.createdAt ?? now,
      entry.lastUsedAt ?? now,
    ],
  );

  return res.rows[0].id as string;
}

export async function updateUsedCount(memoryId: string): Promise<void> {
  await pool.query(
    "UPDATE nura_memories SET used_count = used_count + 1, last_used_at = $1 WHERE id = $2",
    [Date.now(), memoryId],
  );
}

export async function deleteMemory(memoryId: string): Promise<void> {
  await pool.query("DELETE FROM nura_memories WHERE id = $1", [memoryId]);
}

// ── Read operations ───────────────────────────────────────────────────────────

export async function loadMemories(opts: {
  projectId?: number;
  categories?: MemoryCategory[];
  limit?: number;
}): Promise<MemoryEntry[]> {
  const conditions: string[] = [];
  const params: unknown[]    = [];
  let   idx = 1;

  if (opts.projectId !== undefined) {
    conditions.push(`(project_id = $${idx} OR project_id IS NULL)`);
    params.push(opts.projectId); idx++;
  }
  if (opts.categories?.length) {
    conditions.push(`category = ANY($${idx})`);
    params.push(opts.categories); idx++;
  }

  const where  = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit  = opts.limit ?? 500;

  const res = await pool.query(
    `SELECT * FROM nura_memories ${where} ORDER BY last_used_at DESC LIMIT $${idx}`,
    [...params, limit],
  );

  return res.rows.map(rowToEntry);
}

export async function getMemoryStats(): Promise<VectorStoreStats> {
  const res = await pool.query(`
    SELECT
      COUNT(*)::int                      AS total,
      MIN(created_at)                    AS oldest_ms,
      MAX(created_at)                    AS newest_ms,
      AVG(score)::real                   AS avg_score,
      category,
      COUNT(*)::int                      AS cat_count
    FROM nura_memories
    GROUP BY category
  `);

  const byCategory = {} as Record<MemoryCategory, number>;
  let total = 0, oldestMs = Date.now(), newestMs = 0, avgScore = 0;

  for (const row of res.rows) {
    byCategory[row.category as MemoryCategory] = row.cat_count as number;
    total    += row.cat_count as number;
    oldestMs  = Math.min(oldestMs, Number(row.oldest_ms));
    newestMs  = Math.max(newestMs, Number(row.newest_ms));
    avgScore  = row.avg_score as number;
  }

  return { total, byCategory, avgScore, oldestMs, newestMs };
}
