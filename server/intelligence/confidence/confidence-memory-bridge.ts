/**
 * confidence-memory-bridge.ts
 *
 * Persists and restores agent confidence data using the project memory system.
 * Writes to .nura/confidence/ files within each project sandbox.
 * Bridges the in-memory confidence/reliability stores to disk.
 *
 * FAIL-CLOSED: persistence failures are logged but never crash the system.
 *
 * ALL writes are routed through memoryWriteQueue:
 *   ✅ atomic commit via temp-file + fsync + rename
 *   ✅ validation before commit
 *   ✅ rollback on failure
 *   ✅ full telemetry
 */

import fs   from "fs";
import path from "path";
import type { AgentConfidenceRecord } from "./confidence-types.ts";
import { getAllRecords, upsertConfidence }   from "./stores/confidence-store.ts";
import { appendReliabilityEntry, getHistory, clearAll as clearReliability } from "./stores/reliability-store.ts";
import { exportSummaries } from "./stores/reliability-store.ts";
import { scoreToState }    from "./confidence-thresholds.ts";
import { memoryWriteQueue } from "../../quantum/memory/index.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIDENCE_DIR  = ".nura/confidence";
const RECORDS_FILE    = "confidence-records.json";
const SUMMARIES_FILE  = "reliability-summaries.json";
const HISTORY_FILE    = "reliability-history.json";
const MAX_HISTORY     = 500;
const OWNER           = "confidence-bridge";

// ── Path resolver ─────────────────────────────────────────────────────────────

function confidenceDir(sandboxPath: string): string {
  return path.join(sandboxPath, CONFIDENCE_DIR);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ── Queue key: use sandboxPath as the lane identifier ─────────────────────────

function queueKey(sandboxPath: string): string {
  return `confidence:${sandboxPath}`;
}

// ── Persistence ────────────────────────────────────────────────────────────────

/**
 * Flush all in-memory confidence and reliability data to disk.
 */
export async function persistConfidence(sandboxPath: string): Promise<void> {
  try {
    const dir = confidenceDir(sandboxPath);
    ensureDir(dir);

    const records   = getAllRecords();
    const summaries = exportSummaries();

    await memoryWriteQueue.enqueue({
      queueKey: queueKey(sandboxPath),
      filePath: path.join(dir, RECORDS_FILE),
      content:  JSON.stringify(records, null, 2),
      fileType: "json",
      ownerId:  OWNER,
      runId:    "system",
    });

    await memoryWriteQueue.enqueue({
      queueKey: queueKey(sandboxPath),
      filePath: path.join(dir, SUMMARIES_FILE),
      content:  JSON.stringify(summaries, null, 2),
      fileType: "json",
      ownerId:  OWNER,
      runId:    "system",
    });

    console.debug(`[confidence-memory-bridge] Persisted ${records.length} records to ${dir}`);
  } catch (err) {
    console.error("[confidence-memory-bridge] Persistence failed (non-fatal):", err);
  }
}

/**
 * Restore confidence data from disk into the in-memory stores.
 */
export async function restoreConfidence(sandboxPath: string): Promise<void> {
  try {
    const dir          = confidenceDir(sandboxPath);
    const recordsPath  = path.join(dir, RECORDS_FILE);
    const historyPath  = path.join(dir, HISTORY_FILE);

    if (fs.existsSync(recordsPath)) {
      const raw     = fs.readFileSync(recordsPath, "utf8");
      const records: AgentConfidenceRecord[] = JSON.parse(raw);
      for (const r of records) {
        upsertConfidence({ ...r, state: scoreToState(r.confidenceScore) });
      }
      console.debug(`[confidence-memory-bridge] Restored ${records.length} confidence records`);
    }

    if (fs.existsSync(historyPath)) {
      const raw     = fs.readFileSync(historyPath, "utf8");
      const entries = JSON.parse(raw);
      for (const entry of entries.slice(-MAX_HISTORY)) {
        appendReliabilityEntry(entry);
      }
    }
  } catch (err) {
    console.error("[confidence-memory-bridge] Restore failed (non-fatal):", err);
  }
}

/**
 * Append reliability history slice to disk (atomic read-modify-write).
 */
export async function persistReliabilityHistory(
  sandboxPath: string,
  agentId:     string,
): Promise<void> {
  try {
    const dir         = confidenceDir(sandboxPath);
    ensureDir(dir);
    const historyPath = path.join(dir, HISTORY_FILE);
    const fresh       = getHistory(agentId);

    await memoryWriteQueue.enqueue({
      queueKey: queueKey(sandboxPath),
      filePath: historyPath,
      fileType: "json",
      ownerId:  OWNER,
      runId:    "system",
      mutator:  (current) => {
        const existing: unknown[] = current ? JSON.parse(current) : [];
        const merged = [...existing, ...fresh].slice(-MAX_HISTORY);
        return JSON.stringify(merged, null, 2);
      },
    });
  } catch (err) {
    console.error("[confidence-memory-bridge] History persist failed (non-fatal):", err);
  }
}

/**
 * Build a human-readable confidence summary for inclusion in LLM memory context.
 */
export function buildConfidenceContextBlock(): string {
  const summaries = exportSummaries();
  const entries   = Object.entries(summaries)
    .sort(([, a], [, b]) => b.ewmaScore - a.ewmaScore)
    .slice(0, 10);

  if (entries.length === 0) return "";

  const lines = entries.map(([id, s]) =>
    `  ${id}: reliability=${(s.ewmaScore * 100).toFixed(0)}% ` +
    `success=${(s.successRate * 100).toFixed(0)}% ` +
    `hallucination=${(s.hallucinationRate * 100).toFixed(0)}% ` +
    `runs=${s.totalRuns}`,
  );

  return `## Agent Reliability Summary\n${lines.join("\n")}`;
}
