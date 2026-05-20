/**
 * memory-paths.ts
 *
 * Path constants for the .nura/ memory directory inside each project sandbox.
 *
 * Layout:
 *   .data/sandboxes/:projectId/.nura/
 *     context.md        — rolling run log (one line per run)
 *     architecture.md   — evolving architecture narrative (human-readable)
 *     run-history.jsonl — one JSON line per completed run
 *     decisions.json    — rolling last-20 architecture decisions
 *     failures.json     — rolling last-10 failure entries
 *
 * Ownership: memory/persistence — pure path helpers, no I/O.
 */

import path from "path";
import { getProjectDir } from "../../../infrastructure/sandbox/sandbox.util.ts";

export const NURA_DIR_NAME = ".nura";

export function getMemoryDir(projectId: number): string {
  return path.join(getProjectDir(projectId), NURA_DIR_NAME);
}

export function getContextPath(projectId: number): string {
  return path.join(getMemoryDir(projectId), "context.md");
}

export function getArchitecturePath(projectId: number): string {
  return path.join(getMemoryDir(projectId), "architecture.md");
}

export function getRunHistoryPath(projectId: number): string {
  return path.join(getMemoryDir(projectId), "run-history.jsonl");
}

export function getDecisionsPath(projectId: number): string {
  return path.join(getMemoryDir(projectId), "decisions.json");
}

export function getFailuresPath(projectId: number): string {
  return path.join(getMemoryDir(projectId), "failures.json");
}

// ─── Human-readable .md files (C9 additions) ─────────────────────────────────

export function getProgressPath(projectId: number): string {
  return path.join(getMemoryDir(projectId), "progress.md");
}

export function getDecisionsMdPath(projectId: number): string {
  return path.join(getMemoryDir(projectId), "decisions.md");
}

export function getFailedAttemptsPath(projectId: number): string {
  return path.join(getMemoryDir(projectId), "failed-attempts.md");
}
