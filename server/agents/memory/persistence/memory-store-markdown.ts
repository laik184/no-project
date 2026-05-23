/**
 * memory-store-markdown.ts
 *
 * Markdown memory stores: progress.md, decisions.md, failed-attempts.md.
 * Extracted from memory-store.ts (keep each file ≤250 lines).
 *
 * Single responsibility: human-readable markdown append-log stores only.
 */

import fs from "fs/promises";
import {
  getProgressPath,
  getDecisionsMdPath,
  getFailedAttemptsPath,
} from "./memory-paths.ts";
import { memoryWriteQueue } from "../../../quantum/memory/index.ts";
import { ensureMemoryDir }  from "./memory-store-core.ts";

const MAX_MD_CHARS = 6_000;
const OWNER        = "memory-store";
const today        = () => new Date().toISOString().slice(0, 10);

// ── progress.md ───────────────────────────────────────────────────────────────

const PROGRESS_HEADER = "# Project Progress\n\nTracks completed milestones and current project state across agent runs.\n\n";

export async function readProgressMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getProgressPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function appendProgressMd(projectId: number, entry: string): Promise<void> {
  await ensureMemoryDir(projectId);
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getProgressPath(projectId),
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const base    = current || PROGRESS_HEADER;
      const updated = base + `\n## [${today()}]\n${entry.trim()}\n`;
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
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getDecisionsMdPath(projectId),
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const base    = current || DECISIONS_MD_HEADER;
      const updated = base + `\n## [${today()}]\n${entry.trim()}\n`;
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
  await memoryWriteQueue.enqueue({
    queueKey: String(projectId),
    filePath: getFailedAttemptsPath(projectId),
    fileType: "markdown",
    ownerId:  OWNER,
    runId:    "system",
    mutator:  (current) => {
      const base    = current || FAILED_HEADER;
      const updated = base + `\n## [${today()}]\n${entry.trim()}\n`;
      return updated.length > MAX_MD_CHARS ? FAILED_HEADER + updated.slice(-MAX_MD_CHARS) : updated;
    },
  });
}
