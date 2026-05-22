/**
 * superposition-manager.ts
 *
 * Central coordinator for all execution paths within one quantum run.
 * Spawns paths, monitors lifecycle, waits for completion, triggers collapse.
 * All paths are isolated and communicate only through this manager.
 */

import type { QuantumRunInput }    from "../types/quantum.types.ts";
import type { ExecutionPath }      from "../types/path.types.ts";
import type { ExecutionStrategy }  from "../types/quantum.types.ts";
import { createExecutionPath }     from "./execution-path.ts";
import {
  registerPath,
  updatePath,
  getPathsForRun,
  allPathsTerminal,
  clearRun,
} from "./path-registry.ts";
import { transition, cancelAll }   from "./path-lifecycle.ts";
import {
  telemetryPathSpawned,
  telemetryPathStarted,
  telemetryPathCompleted,
  telemetryPathFailed,
} from "../telemetry/quantum-telemetry.ts";

// ── Spawn ─────────────────────────────────────────────────────────────────────

export function spawnPaths(
  input:      QuantumRunInput,
  strategies: ExecutionStrategy[],
): ExecutionPath[] {
  const paths: ExecutionPath[] = [];

  for (const strategy of strategies) {
    let path = createExecutionPath(input.quantumRunId, strategy, input.sandboxRoot);
    path     = transition(path, "SPAWNING");
    registerPath(path);
    telemetryPathSpawned(path, input.runId);
    paths.push(path);
  }

  return paths;
}

// ── Mark running ──────────────────────────────────────────────────────────────

export function markPathRunning(path: ExecutionPath, runId: string): ExecutionPath {
  const updated = transition(path, "RUNNING");
  updatePath(updated);
  telemetryPathStarted(updated, runId);
  return updated;
}

// ── Mark completed ────────────────────────────────────────────────────────────

export function markPathCompleted(path: ExecutionPath, runId: string): ExecutionPath {
  const updated = transition(path, "VERIFYING");
  updatePath(updated);
  telemetryPathCompleted(updated, runId);
  return updated;
}

// ── Mark failed ───────────────────────────────────────────────────────────────

export function markPathFailed(
  path:   ExecutionPath,
  runId:  string,
  reason: string,
): ExecutionPath {
  let updated = path;
  try {
    updated = transition(path, "FAILED");
  } catch {
    // already terminal — just log
  }
  updatePath(updated);
  telemetryPathFailed(updated, runId, reason);
  return updated;
}

// ── Wait for all paths to reach terminal state ────────────────────────────────

export async function waitForAll(
  quantumRunId: string,
  timeoutMs:    number,
  pollMs        = 200,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (allPathsTerminal(quantumRunId)) return true;
    await new Promise(r => setTimeout(r, pollMs));
  }

  // Timeout — cancel any still-running paths
  const paths = getPathsForRun(quantumRunId);
  cancelAll(paths.filter(p => !["COLLAPSED","FAILED","CANCELLED","MERGING"].includes(p.state)));
  console.warn(`[superposition-manager] Timeout waiting for quantumRunId=${quantumRunId}`);
  return false;
}

// ── Wait for minimum viable paths ────────────────────────────────────────────

export async function waitForMinimum(
  quantumRunId:  string,
  minCompleted:  number,
  timeoutMs:     number,
  pollMs         = 200,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const completed = getPathsForRun(quantumRunId)
      .filter(p => p.state === "VERIFYING" && p.verificationPassed).length;
    if (completed >= minCompleted) return true;
    if (allPathsTerminal(quantumRunId)) break;
    await new Promise(r => setTimeout(r, pollMs));
  }

  return false;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function getSnapshot(quantumRunId: string): {
  total: number; running: number; completed: number; failed: number;
} {
  const paths = getPathsForRun(quantumRunId);
  return {
    total:     paths.length,
    running:   paths.filter(p => p.state === "RUNNING" || p.state === "SPAWNING").length,
    completed: paths.filter(p => p.state === "VERIFYING" || p.state === "MERGING").length,
    failed:    paths.filter(p => p.state === "FAILED" || p.state === "CANCELLED").length,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function cleanup(quantumRunId: string): void {
  const paths = getPathsForRun(quantumRunId);
  // Abort all AbortControllers to clean up any in-flight work
  for (const p of paths) {
    try { p.abortController.abort(); } catch { /* noop */ }
  }
  clearRun(quantumRunId);
}
