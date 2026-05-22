/**
 * planner.memory.ts
 *
 * Persists execution plans and phase results to the sandbox directory.
 * Enables recovery, auditing, and future checkpoint support.
 *
 * ALL writes are routed through memoryWriteQueue:
 *   ✅ atomic commit via temp-file + fsync + rename
 *   ✅ validation before commit
 *   ✅ rollback on failure
 *   ✅ full telemetry
 */

import fs from "fs/promises";
import path from "path";
import type { ExecutionPlan, PhaseResult } from "./planner.types.ts";
import { memoryWriteQueue } from "../../quantum/memory/index.ts";

const SANDBOX_ROOT = process.env.AGENT_PROJECT_ROOT || ".sandbox";
const OWNER        = "planner-memory";

function planDir(projectId: number, runId: string): string {
  return path.join(SANDBOX_ROOT, String(projectId), ".nura", "plans", runId);
}

// ── Queue key: plans are scoped to a project, not tied to a numeric projectId
// in the memory-store sense, so we use "planner:<projectId>" to keep lanes isolated.

function queueKey(projectId: number): string {
  return `planner:${projectId}`;
}

export async function savePlan(plan: ExecutionPlan): Promise<void> {
  const dir      = planDir(plan.projectId, plan.runId);
  const filePath = path.join(dir, "plan.json");

  await fs.mkdir(dir, { recursive: true });
  await memoryWriteQueue.enqueue({
    queueKey: queueKey(plan.projectId),
    filePath,
    content:  JSON.stringify(plan, null, 2),
    fileType: "json",
    ownerId:  OWNER,
    runId:    plan.runId,
  });
}

export async function savePhaseResult(
  projectId: number,
  runId:     string,
  result:    PhaseResult,
): Promise<void> {
  const dir      = planDir(projectId, runId);
  const filePath = path.join(dir, `${result.phaseId}.result.json`);

  await fs.mkdir(dir, { recursive: true });
  await memoryWriteQueue.enqueue({
    queueKey: queueKey(projectId),
    filePath,
    content:  JSON.stringify(result, null, 2),
    fileType: "json",
    ownerId:  OWNER,
    runId,
  });
}

export async function loadPlan(
  projectId: number,
  runId:     string,
): Promise<ExecutionPlan | null> {
  const file = path.join(planDir(projectId, runId), "plan.json");
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as ExecutionPlan;
  } catch {
    return null;
  }
}

export async function listPlans(projectId: number): Promise<string[]> {
  const base = path.join(SANDBOX_ROOT, String(projectId), ".nura", "plans");
  try {
    return await fs.readdir(base);
  } catch {
    return [];
  }
}
