/**
 * path-lifecycle.ts
 *
 * Enforces valid state machine transitions for execution paths.
 * Guards against illegal transitions and emits lifecycle telemetry.
 */

import type { PathLifecycleState, ExecutionPath } from "../types/path.types.ts";
import { transitionPath } from "./execution-path.ts";
import { updatePath }      from "./path-registry.ts";

// ── Valid transitions ─────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<PathLifecycleState, PathLifecycleState[]> = {
  IDLE:       ["SPAWNING", "CANCELLED"],
  SPAWNING:   ["RUNNING",  "FAILED", "CANCELLED"],
  RUNNING:    ["VERIFYING","FAILED", "CANCELLED"],
  VERIFYING:  ["MERGING",  "FAILED", "CANCELLED"],
  MERGING:    ["COLLAPSED","FAILED"],
  COLLAPSED:  [],
  FAILED:     [],
  CANCELLED:  [],
};

// ── Transition guard ──────────────────────────────────────────────────────────

export function canTransition(
  from: PathLifecycleState,
  to:   PathLifecycleState,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(
  path: ExecutionPath,
  to:   PathLifecycleState,
): ExecutionPath {
  if (!canTransition(path.state, to)) {
    throw new Error(
      `[path-lifecycle] Illegal transition ${path.pathId}: ${path.state} → ${to}`,
    );
  }
  const updated = transitionPath(path, to);
  updatePath(updated);
  return updated;
}

// ── Safe transition (no-throw variant) ───────────────────────────────────────

export function tryTransition(
  path: ExecutionPath,
  to:   PathLifecycleState,
): ExecutionPath {
  if (!canTransition(path.state, to)) {
    console.warn(
      `[path-lifecycle] Cannot transition ${path.pathId} from ${path.state} → ${to} — skipped`,
    );
    return path;
  }
  return transition(path, to);
}

// ── Batch cancel ──────────────────────────────────────────────────────────────

export function cancelAll(paths: ExecutionPath[]): ExecutionPath[] {
  return paths.map(p => {
    if (["COLLAPSED", "FAILED", "CANCELLED"].includes(p.state)) return p;
    try {
      p.abortController.abort();
      return transition(p, "CANCELLED");
    } catch {
      return p;
    }
  });
}

// ── Terminal check ────────────────────────────────────────────────────────────

export function isTerminalState(state: PathLifecycleState): boolean {
  return VALID_TRANSITIONS[state].length === 0;
}

export function isSuccessTerminal(path: ExecutionPath): boolean {
  return path.state === "COLLAPSED";
}

export function isFailureTerminal(path: ExecutionPath): boolean {
  return path.state === "FAILED" || path.state === "CANCELLED";
}
