/**
 * memory-store.ts
 *
 * All file I/O for the .nura/ project memory directory.
 *
 * Files managed:
 *   context.md          — rolling run log (one entry per run)
 *   architecture.md     — evolving architecture narrative
 *   run-history.jsonl   — one JSON line per completed run
 *   decisions.json      — structured decision history (last-20)
 *   failures.json       — structured failure history (last-10)
 *   progress.md         — human-readable project progress tracker
 *   decisions.md        — human-readable architectural decisions
 *   failed-attempts.md  — human-readable failure log
 *
 * Ownership: memory/persistence — I/O only, no logic.
 *
 * ALL writes are routed through memoryWriteQueue to guarantee:
 *   ✅ serialised per-project execution
 *   ✅ atomic commit via temp-file + fsync + rename
 *   ✅ format validation before commit
 *   ✅ rollback on failure
 *   ✅ full telemetry
 */

import fs from "fs/promises";
import {
  getMemoryDir,
  getContextPath,
  getArchitecturePath,
  getRunHistoryPath,
  getDecisionsPath,
  getFailuresPath,
  getProgressPath,
  getDecisionsMdPath,
  getFailedAttemptsPath,
} from "./memory-paths.ts";
import type { RunSummary, FailureEntry, ArchitectureDecision } from "../types.ts";
import { memoryWriteQueue } from "../../../quantum/memory/index.ts";

const MAX_FAILURES  = 10;
const MAX_DECISIONS = 20;
const MAX_MD_CHARS  = 6_000;

const OWNER = "memory-store";

// ── Directory ─────────────────────────────────────────────────────────────────

export async function ensureMemoryDir(projectId: number): Promise<void> {
  await fs.mkdir(getMemoryDir(projectId), { recursive: true });
}

// ── context.md ────────────────────────────────────────────────────────────────

export async function readContextMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getContextPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function writeContextMd(projectId: number, content: string): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getContextPath(projectId),
    content,
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
  });
}

// ── architecture.md ───────────────────────────────────────────────────────────

export async function readArchitectureMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getArchitecturePath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function writeArchitectureMd(projectId: number, content: string): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getArchitecturePath(projectId),
    content,
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
  });
}

// ── run-history.jsonl ─────────────────────────────────────────────────────────

export async function appendRunSummary(
  projectId: number,
  summary:   RunSummary,
): Promise<void> {
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

export async function readRecentRuns(
  projectId: number,
  limit = 5,
): Promise<RunSummary[]> {
  try {
    const raw   = await fs.readFile(getRunHistoryPath(projectId), "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map(l => JSON.parse(l) as RunSummary).reverse();
  } catch { return []; }
}

// ── decisions.json ────────────────────────────────────────────────────────────

export async function readDecisions(projectId: number): Promise<ArchitectureDecision[]> {
  try {
    const raw = await fs.readFile(getDecisionsPath(projectId), "utf-8");
    return JSON.parse(raw) as ArchitectureDecision[];
  } catch { return []; }
}

export async function appendDecision(
  projectId: number,
  decision:  ArchitectureDecision,
): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getDecisionsPath(projectId),
    fileType: "json",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const existing = current ? (JSON.parse(current) as ArchitectureDecision[]) : [];
      const updated  = [decision, ...existing].slice(0, MAX_DECISIONS);
      return JSON.stringify(updated, null, 2);
    },
  });
}

// ── failures.json ─────────────────────────────────────────────────────────────

export async function readFailures(projectId: number): Promise<FailureEntry[]> {
  try {
    const raw = await fs.readFile(getFailuresPath(projectId), "utf-8");
    return JSON.parse(raw) as FailureEntry[];
  } catch { return []; }
}

export async function appendFailure(
  projectId: number,
  entry:     FailureEntry,
): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getFailuresPath(projectId),
    fileType: "json",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const existing = current ? (JSON.parse(current) as FailureEntry[]) : [];
      const updated  = [entry, ...existing].slice(0, MAX_FAILURES);
      return JSON.stringify(updated, null, 2);
    },
  });
}

// ── progress.md ───────────────────────────────────────────────────────────────

const PROGRESS_HEADER = "# Project Progress\n\nTracks completed milestones and current project state across agent runs.\n\n";

export async function readProgressMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getProgressPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function appendProgressMd(projectId: number, entry: string): Promise<void> {
  await ensureMemoryDir(projectId);
  const date = new Date().toISOString().slice(0, 10);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getProgressPath(projectId),
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const existing = current || PROGRESS_HEADER;
      const updated  = existing + `\n## [${date}]\n${entry.trim()}\n`;
      return updated.length > MAX_MD_CHARS ? PROGRESS_HEADER + updated.slice(-MAX_MD_CHARS) : updated;
    },
  });
}

// ── decisions.md ──────────────────────────────────────────────────────────────

const DECISIONS_MD_HEADER = "# Architectural Decisions\n\nKey technical and design decisions made across agent runs.\n\n";

export async function readDecisionsMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getDecisionsMdPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function appendDecisionMd(projectId: number, entry: string): Promise<void> {
  await ensureMemoryDir(projectId);
  const date = new Date().toISOString().slice(0, 10);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getDecisionsMdPath(projectId),
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const existing = current || DECISIONS_MD_HEADER;
      const updated  = existing + `\n## [${date}]\n${entry.trim()}\n`;
      return updated.length > MAX_MD_CHARS ? DECISIONS_MD_HEADER + updated.slice(-MAX_MD_CHARS) : updated;
    },
  });
}

// ── failed-attempts.md ────────────────────────────────────────────────────────

const FAILED_HEADER = "# Failed Attempts — Do NOT Repeat\n\nBroken approaches the agent must avoid repeating.\n\n";

export async function readFailedAttemptsMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getFailedAttemptsPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function appendFailedAttemptMd(projectId: number, entry: string): Promise<void> {
  await ensureMemoryDir(projectId);
  const date = new Date().toISOString().slice(0, 10);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getFailedAttemptsPath(projectId),
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const existing = current || FAILED_HEADER;
      const updated  = existing + `\n## [${date}]\n${entry.trim()}\n`;
      return updated.length > MAX_MD_CHARS ? FAILED_HEADER + updated.slice(-MAX_MD_CHARS) : updated;
    },
  });
}
