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
 *   progress.md         — human-readable project progress tracker  [C9]
 *   decisions.md        — human-readable architectural decisions    [C9]
 *   failed-attempts.md  — human-readable failure log               [C9]
 *
 * Ownership: memory/persistence — I/O only, no logic.
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

const MAX_FAILURES  = 10;
const MAX_DECISIONS = 20;
const MAX_MD_CHARS  = 6_000;   // rolling cap for human-readable .md files

// ─── Directory ────────────────────────────────────────────────────────────────

export async function ensureMemoryDir(projectId: number): Promise<void> {
  await fs.mkdir(getMemoryDir(projectId), { recursive: true });
}

// ─── context.md ──────────────────────────────────────────────────────────────

export async function readContextMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getContextPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function writeContextMd(projectId: number, content: string): Promise<void> {
  await ensureMemoryDir(projectId);
  await fs.writeFile(getContextPath(projectId), content, "utf-8");
}

// ─── architecture.md ─────────────────────────────────────────────────────────

export async function readArchitectureMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getArchitecturePath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function writeArchitectureMd(projectId: number, content: string): Promise<void> {
  await ensureMemoryDir(projectId);
  await fs.writeFile(getArchitecturePath(projectId), content, "utf-8");
}

// ─── run-history.jsonl ────────────────────────────────────────────────────────

export async function appendRunSummary(
  projectId: number,
  summary:   RunSummary,
): Promise<void> {
  await ensureMemoryDir(projectId);
  await fs.appendFile(getRunHistoryPath(projectId), JSON.stringify(summary) + "\n", "utf-8");
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

// ─── decisions.json ───────────────────────────────────────────────────────────

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
  const existing = await readDecisions(projectId);
  const updated  = [decision, ...existing].slice(0, MAX_DECISIONS);
  await fs.writeFile(getDecisionsPath(projectId), JSON.stringify(updated, null, 2), "utf-8");
}

// ─── failures.json ────────────────────────────────────────────────────────────

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
  const existing = await readFailures(projectId);
  const updated  = [entry, ...existing].slice(0, MAX_FAILURES);
  await fs.writeFile(getFailuresPath(projectId), JSON.stringify(updated, null, 2), "utf-8");
}

// ─── progress.md  [C9] ────────────────────────────────────────────────────────

const PROGRESS_HEADER = "# Project Progress\n\nTracks completed milestones and current project state across agent runs.\n\n";

export async function readProgressMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getProgressPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function appendProgressMd(projectId: number, entry: string): Promise<void> {
  await ensureMemoryDir(projectId);
  let existing = await readProgressMd(projectId);
  if (!existing) existing = PROGRESS_HEADER;
  const date    = new Date().toISOString().slice(0, 10);
  const updated = existing + `\n## [${date}]\n${entry.trim()}\n`;
  const pruned  = updated.length > MAX_MD_CHARS ? PROGRESS_HEADER + updated.slice(-MAX_MD_CHARS) : updated;
  await fs.writeFile(getProgressPath(projectId), pruned, "utf-8");
}

// ─── decisions.md  [C9] ───────────────────────────────────────────────────────

const DECISIONS_MD_HEADER = "# Architectural Decisions\n\nKey technical and design decisions made across agent runs.\n\n";

export async function readDecisionsMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getDecisionsMdPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function appendDecisionMd(projectId: number, entry: string): Promise<void> {
  await ensureMemoryDir(projectId);
  let existing = await readDecisionsMd(projectId);
  if (!existing) existing = DECISIONS_MD_HEADER;
  const date    = new Date().toISOString().slice(0, 10);
  const updated = existing + `\n## [${date}]\n${entry.trim()}\n`;
  const pruned  = updated.length > MAX_MD_CHARS ? DECISIONS_MD_HEADER + updated.slice(-MAX_MD_CHARS) : updated;
  await fs.writeFile(getDecisionsMdPath(projectId), pruned, "utf-8");
}

// ─── failed-attempts.md  [C9] ─────────────────────────────────────────────────

const FAILED_HEADER = "# Failed Attempts — Do NOT Repeat\n\nBroken approaches the agent must avoid repeating.\n\n";

export async function readFailedAttemptsMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getFailedAttemptsPath(projectId), "utf-8"); }
  catch { return ""; }
}

export async function appendFailedAttemptMd(projectId: number, entry: string): Promise<void> {
  await ensureMemoryDir(projectId);
  let existing = await readFailedAttemptsMd(projectId);
  if (!existing) existing = FAILED_HEADER;
  const date    = new Date().toISOString().slice(0, 10);
  const updated = existing + `\n## [${date}]\n${entry.trim()}\n`;
  const pruned  = updated.length > MAX_MD_CHARS ? FAILED_HEADER + updated.slice(-MAX_MD_CHARS) : updated;
  await fs.writeFile(getFailedAttemptsPath(projectId), pruned, "utf-8");
}
