/**
 * memory-store-json.ts
 *
 * JSON/JSONL memory stores: run-history.jsonl, decisions.json, failures.json.
 * Extracted from memory-store.ts (keep each file ≤250 lines).
 *
 * Single responsibility: structured data I/O only.
 */

import fs from "fs/promises";
import {
  getRunHistoryPath,
  getDecisionsPath,
  getFailuresPath,
} from "./memory-paths.ts";
import type { RunSummary, FailureEntry, ArchitectureDecision } from "../types.ts";
import { memoryWriteQueue } from "../../../quantum/memory/index.ts";
import { ensureMemoryDir }  from "./memory-store-core.ts";

const MAX_FAILURES  = 10;
const MAX_DECISIONS = 20;
const OWNER = "memory-store";

// ── run-history.jsonl ─────────────────────────────────────────────────────────

export async function appendRunSummary(projectId: number, summary: RunSummary): Promise<void> {
  await ensureMemoryDir(projectId);
  const line = JSON.stringify(summary) + "\n";
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getRunHistoryPath(projectId),
    fileType: "jsonl",
    ownerId:  OWNER,
    runId:    summary.runId ?? "system",
    mutator:  (current) => current + line,
  });
}

export async function readRecentRuns(projectId: number, limit = 5): Promise<RunSummary[]> {
  try {
    const raw   = await fs.readFile(getRunHistoryPath(projectId), "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map(l => JSON.parse(l) as RunSummary).reverse();
  } catch { return []; }
}

// ── decisions.json ────────────────────────────────────────────────────────────

export async function readDecisions(projectId: number): Promise<ArchitectureDecision[]> {
  try { return JSON.parse(await fs.readFile(getDecisionsPath(projectId), "utf-8")); }
  catch { return []; }
}

export async function appendDecision(projectId: number, decision: ArchitectureDecision): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getDecisionsPath(projectId),
    fileType: "json",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const existing = current ? (JSON.parse(current) as ArchitectureDecision[]) : [];
      return JSON.stringify([decision, ...existing].slice(0, MAX_DECISIONS), null, 2);
    },
  });
}

// ── failures.json ─────────────────────────────────────────────────────────────

export async function readFailures(projectId: number): Promise<FailureEntry[]> {
  try { return JSON.parse(await fs.readFile(getFailuresPath(projectId), "utf-8")); }
  catch { return []; }
}

export async function appendFailure(projectId: number, entry: FailureEntry): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getFailuresPath(projectId),
    fileType: "json",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const existing = current ? (JSON.parse(current) as FailureEntry[]) : [];
      return JSON.stringify([entry, ...existing].slice(0, MAX_FAILURES), null, 2);
    },
  });
}
