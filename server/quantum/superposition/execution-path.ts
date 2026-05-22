/**
 * execution-path.ts
 *
 * Factory and mutation helpers for ExecutionPath objects.
 * Pure data operations — no store mutations, no bus emissions.
 */

import { v4 as uuid } from "uuid";
import type { ExecutionPath, PathLifecycleState, PathResult } from "../types/path.types.ts";
import type { ExecutionStrategy } from "../types/quantum.types.ts";

// ── Factory ───────────────────────────────────────────────────────────────────

export function createExecutionPath(
  quantumRunId: string,
  strategy:     ExecutionStrategy,
  sandboxRoot:  string,
): ExecutionPath {
  const pathId = `qpath-${uuid().slice(0, 8)}`;

  return {
    pathId,
    quantumRunId,
    strategy:     strategy.id,
    strategyName: strategy.name,
    priority:     strategy.priority,
    state:        "IDLE",
    confidenceScore:    0.70,
    verificationPassed: false,
    hallucinationRisk:  0,
    sandboxSubDir: `${sandboxRoot}/.quantum/${quantumRunId}/${pathId}`,
    abortController: new AbortController(),
    telemetry: {
      spawned:   Date.now(),
      started:   0,
      retries:   0,
      durationMs: 0,
      stepCount:  0,
    },
  };
}

// ── Lifecycle transitions (return new objects — no mutation) ──────────────────

export function transitionPath(
  path:     ExecutionPath,
  newState: PathLifecycleState,
): ExecutionPath {
  const now = Date.now();
  const telemetry = { ...path.telemetry };

  if (newState === "RUNNING" && !telemetry.started) {
    telemetry.started = now;
  }
  if (newState === "COLLAPSED" || newState === "FAILED") {
    telemetry.completed = now;
    telemetry.durationMs = now - (telemetry.started || telemetry.spawned);
  }

  return { ...path, state: newState, telemetry };
}

export function attachResult(path: ExecutionPath, result: PathResult): ExecutionPath {
  return {
    ...path,
    result,
    verificationPassed: result.verificationPassed,
    confidenceScore:    result.success ? 0.80 : 0.20,
    state: result.success ? "VERIFYING" : "FAILED",
    telemetry: {
      ...path.telemetry,
      completed:  result.completedAt,
      durationMs: result.durationMs,
      retries:    result.retries,
    },
  };
}

export function scoreConfidence(path: ExecutionPath, score: number): ExecutionPath {
  return { ...path, confidenceScore: score };
}

export function markHallucination(path: ExecutionPath, risk: number): ExecutionPath {
  return { ...path, hallucinationRisk: risk };
}

export function cancelPath(path: ExecutionPath): ExecutionPath {
  path.abortController.abort();
  return transitionPath(path, "CANCELLED");
}

// ── Predicate helpers ─────────────────────────────────────────────────────────

export function isTerminal(path: ExecutionPath): boolean {
  return ["COLLAPSED", "FAILED", "CANCELLED"].includes(path.state);
}

export function isEligibleForMerge(path: ExecutionPath): boolean {
  return path.state === "VERIFYING" && path.verificationPassed;
}

export function isRunning(path: ExecutionPath): boolean {
  return path.state === "RUNNING" || path.state === "VERIFYING";
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function summarizePath(path: ExecutionPath): string {
  return (
    `[${path.pathId}] strategy=${path.strategyName} ` +
    `state=${path.state} confidence=${path.confidenceScore.toFixed(2)} ` +
    `verified=${path.verificationPassed} dur=${path.telemetry.durationMs}ms`
  );
}
