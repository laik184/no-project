/**
 * tasks-store.ts
 *
 * File I/O for .nura/tasks.md — the project's cross-run task tracker.
 *
 * tasks.md records:
 *   • Pending tasks  — runs that hit the step limit and need continuation
 *   • Completed tasks — successfully finished goals (rolling cap)
 *
 * The file is injected into the LLM context by project-context-builder.ts
 * so the agent knows what unfinished work exists before starting a new run.
 *
 * Ownership: memory/task-memory — I/O + format only, no orchestration logic.
 *
 * ALL writes are routed through memoryWriteQueue:
 *   ✅ serialised per-project execution
 *   ✅ atomic commit via temp-file + fsync + rename
 *   ✅ rollback on failure
 */

import fs   from "fs/promises";
import path from "path";
import { getProjectDir } from "../../../infrastructure/sandbox/sandbox.util.ts";
import { memoryWriteQueue } from "../../../quantum/memory/index.ts";

// ─── Paths ────────────────────────────────────────────────────────────────────

const NURA_DIR   = ".nura";
const TASKS_FILE = "tasks.md";
const OWNER      = "tasks-store";

function getTasksPath(projectId: number): string {
  return path.join(getProjectDir(projectId), NURA_DIR, TASKS_FILE);
}

async function ensureNuraDir(projectId: number): Promise<void> {
  await fs.mkdir(path.join(getProjectDir(projectId), NURA_DIR), { recursive: true });
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function readTasksMd(projectId: number): Promise<string> {
  try { return await fs.readFile(getTasksPath(projectId), "utf-8"); }
  catch { return ""; }
}

// ─── Entry builders ───────────────────────────────────────────────────────────

const HEADER    = "# Task Memory\n\nCross-run task tracker — pending work the agent must resume.\n\n";
const MAX_CHARS = 3_000;

function nowIso(): string { return new Date().toISOString().slice(0, 10); }

/**
 * Append a "needs continuation" entry when a run hits the step limit.
 * The agent reads this on the next run and knows to continue the task.
 */
export async function appendPendingTask(
  projectId: number,
  runId:     string,
  goal:      string,
  stepsUsed: number,
): Promise<void> {
  try {
    await ensureNuraDir(projectId);
    const entry = [
      "",
      `## ⏳ Pending: ${goal.slice(0, 80)}`,
      `- Date: ${nowIso()}`,
      `- RunId: ${runId}`,
      `- Steps used: ${stepsUsed} (hit limit — not yet complete)`,
      `- Action: Resume this task. Do NOT restart from scratch.`,
      "",
    ].join("\n");

    await memoryWriteQueue.enqueue({
      queueKey: String(projectId),
      filePath: getTasksPath(projectId),
      fileType: "markdown",
      ownerId:  OWNER,
      runId,
      mutator:  (current) => {
        const base    = current || HEADER;
        const updated = base + entry;
        return updated.slice(-MAX_CHARS);
      },
    });
  } catch (e) {
    console.warn("[tasks-store] appendPendingTask failed (non-fatal):", (e as Error).message);
  }
}

/**
 * Append a completed entry for a successful run.
 * Keeps a rolling history of what was accomplished.
 */
export async function appendCompletedTask(
  projectId: number,
  runId:     string,
  goal:      string,
): Promise<void> {
  try {
    await ensureNuraDir(projectId);
    const entry = [
      "",
      `## ✅ Done: ${goal.slice(0, 80)}`,
      `- Date: ${nowIso()}`,
      `- RunId: ${runId}`,
      "",
    ].join("\n");

    await memoryWriteQueue.enqueue({
      queueKey: String(projectId),
      filePath: getTasksPath(projectId),
      fileType: "markdown",
      ownerId:  OWNER,
      runId,
      mutator:  (current) => {
        const base    = current || HEADER;
        const updated = base + entry;
        return updated.slice(-MAX_CHARS);
      },
    });
  } catch (e) {
    console.warn("[tasks-store] appendCompletedTask failed (non-fatal):", (e as Error).message);
  }
}
