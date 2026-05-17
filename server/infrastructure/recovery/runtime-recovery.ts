/**
 * runtime-recovery.ts
 * Captures and restores runtime state alongside file checkpoints.
 * Snapshots: running port, PID, command, status, recent logs.
 * On restore: stops any running server so the agent can restart cleanly.
 */

import fs   from "fs/promises";
import path from "path";
import { atomicWrite } from "../checkpoints/atomic-write.util.ts";
import { runtimeManager } from "../runtime/runtime-manager.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RuntimeSnapshot {
  projectId:    number;
  checkpointId: string;
  capturedAt:   number;
  status:       string;
  port:         number | null;
  pid:          number | null;
  command:      string | null;
  restartCount: number;
  recentLogs:   string[];
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const RUNTIME_SNAP_BASE = ".data/checkpoints/v2/runtime";

function runtimeSnapPath(projectId: number, checkpointId: string): string {
  return path.resolve(RUNTIME_SNAP_BASE, String(projectId), `${checkpointId}.json`);
}

// ─── Capture ──────────────────────────────────────────────────────────────────

/**
 * Capture the current runtime state for a project and persist it
 * alongside the file checkpoint. Non-blocking — errors are swallowed.
 */
export async function captureRuntimeSnapshot(
  projectId:    number,
  checkpointId: string,
): Promise<RuntimeSnapshot> {
  const entry = runtimeManager.get(projectId);

  const snap: RuntimeSnapshot = {
    projectId,
    checkpointId,
    capturedAt:   Date.now(),
    status:       entry?.status    ?? "stopped",
    port:         entry?.port      ?? null,
    pid:          entry?.pid       ?? null,
    command:      entry?.command   ?? null,
    restartCount: entry?.restartCount ?? 0,
    recentLogs:   entry ? runtimeManager.getLogs(projectId, 20) : [],
  };

  try {
    const filePath = runtimeSnapPath(projectId, checkpointId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await atomicWrite(filePath, JSON.stringify(snap, null, 2));
  } catch { /* non-fatal */ }

  return snap;
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadRuntimeSnapshot(
  projectId:    number,
  checkpointId: string,
): Promise<RuntimeSnapshot | null> {
  try {
    const raw = await fs.readFile(runtimeSnapPath(projectId, checkpointId), "utf-8");
    return JSON.parse(raw) as RuntimeSnapshot;
  } catch {
    return null;
  }
}

// ─── Restore ──────────────────────────────────────────────────────────────────

/**
 * Prepare the runtime for a rollback:
 *  1. Stop any currently running server for the project.
 *  2. Return the previous runtime state so callers can optionally restart.
 *
 * We do NOT auto-restart — that's the agent's job after the rollback completes.
 */
export async function prepareRuntimeForRollback(
  projectId:    number,
  checkpointId: string,
): Promise<{ stopped: boolean; previousSnapshot: RuntimeSnapshot | null }> {
  const previousSnapshot = await loadRuntimeSnapshot(projectId, checkpointId);

  let stopped = false;
  if (runtimeManager.isRunning(projectId)) {
    const result = runtimeManager.stop(projectId);
    stopped = result.ok;
    if (stopped) {
      console.log(`[runtime-recovery] Stopped runtime for project ${projectId} before rollback`);
    }
  }

  return { stopped, previousSnapshot };
}

// ─── List runtime snapshots ───────────────────────────────────────────────────

export async function listRuntimeSnapshots(projectId: number): Promise<string[]> {
  const dir = path.resolve(RUNTIME_SNAP_BASE, String(projectId));
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((e) => e.endsWith(".json"))
      .map((e) => e.replace(".json", ""))
      .sort();
  } catch {
    return [];
  }
}
