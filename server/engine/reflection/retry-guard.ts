/**
 * server/engine/reflection/retry-guard.ts
 *
 * Per-project retry and recursion guard for the Reflection Engine.
 *
 * Single responsibility: prevent runaway reflection loops.
 *
 * Protects against:
 *   ❌ Infinite reflection recursion (reflection triggering itself)
 *   ❌ Rapid-fire reflection spam (>N reflections per project per window)
 *   ❌ Restart loops (stop reflection if restart count exceeds threshold)
 *   ❌ Same failure repeating without progress
 *
 * Does NOT execute anything. Returns allow/deny with reason.
 */

import type { ReflectionFailureClass } from "./reflection-types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_REFLECTIONS_PER_WINDOW = 5;
const WINDOW_MS                  = 5 * 60_000;  // 5 minutes
const MAX_SAME_CLASS_ATTEMPTS    = 2;            // max attempts for same failure class
const RECURSION_LOCK_TIMEOUT_MS  = 30_000;       // auto-clear stuck recursion lock

// ── State ─────────────────────────────────────────────────────────────────────

interface GuardEntry {
  attempts:      number;
  windowStart:   number;
  inReflection:  boolean;
  lockTs:        number;
  classCounts:   Map<ReflectionFailureClass, number>;
  restartCount:  number;
}

const _state = new Map<number, GuardEntry>();

function getOrCreate(projectId: number): GuardEntry {
  if (!_state.has(projectId)) {
    _state.set(projectId, {
      attempts:     0,
      windowStart:  Date.now(),
      inReflection: false,
      lockTs:       0,
      classCounts:  new Map(),
      restartCount: 0,
    });
  }
  return _state.get(projectId)!;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GuardDecision {
  allowed: boolean;
  reason?: string;
}

/**
 * Check whether reflection is allowed for this project.
 * Call BEFORE starting any reflection work.
 */
export function canReflect(
  projectId:    number,
  failureClass: ReflectionFailureClass,
): GuardDecision {
  const entry = getOrCreate(projectId);
  const now   = Date.now();

  // Auto-clear stale recursion lock
  if (entry.inReflection && now - entry.lockTs > RECURSION_LOCK_TIMEOUT_MS) {
    entry.inReflection = false;
    console.warn(`[retry-guard] Auto-cleared stale reflection lock for project ${projectId}`);
  }

  // Block recursive reflection
  if (entry.inReflection) {
    return { allowed: false, reason: "Recursive reflection blocked — reflection already in progress" };
  }

  // Reset window if expired
  if (now - entry.windowStart > WINDOW_MS) {
    entry.attempts    = 0;
    entry.windowStart = now;
    entry.classCounts.clear();
    entry.restartCount = 0;
  }

  // Window rate limit
  if (entry.attempts >= MAX_REFLECTIONS_PER_WINDOW) {
    return {
      allowed: false,
      reason:  `Reflection rate limit: ${entry.attempts}/${MAX_REFLECTIONS_PER_WINDOW} in 5-min window`,
    };
  }

  // Same failure class limit
  const classAttempts = entry.classCounts.get(failureClass) ?? 0;
  if (classAttempts >= MAX_SAME_CLASS_ATTEMPTS) {
    return {
      allowed: false,
      reason:  `Failure class "${failureClass}" attempted ${classAttempts} times without resolution — escalating`,
    };
  }

  return { allowed: true };
}

/**
 * Mark reflection as started. MUST be paired with markReflectionDone().
 */
export function markReflectionStarted(
  projectId:    number,
  failureClass: ReflectionFailureClass,
): void {
  const entry = getOrCreate(projectId);
  entry.inReflection = true;
  entry.lockTs       = Date.now();
  entry.attempts++;
  entry.classCounts.set(failureClass, (entry.classCounts.get(failureClass) ?? 0) + 1);
}

/**
 * Mark reflection as complete. Always call in finally block.
 */
export function markReflectionDone(projectId: number): void {
  const entry = _state.get(projectId);
  if (entry) entry.inReflection = false;
}

/**
 * Record a restart attempt. Returns false if restart loop threshold exceeded.
 */
export function recordRestart(projectId: number): boolean {
  const entry = getOrCreate(projectId);
  entry.restartCount++;
  if (entry.restartCount > 3) {
    console.error(`[retry-guard] Restart loop detected for project ${projectId} (${entry.restartCount} restarts)`);
    return false;
  }
  return true;
}

/** Reset all guard state for a project (e.g. on successful start). */
export function resetGuard(projectId: number): void {
  _state.delete(projectId);
}

/** Diagnostic snapshot. */
export function guardSnapshot(projectId: number): object {
  const e = _state.get(projectId);
  if (!e) return { projectId, state: "clean" };
  return {
    projectId,
    attempts:     e.attempts,
    inReflection: e.inReflection,
    restartCount: e.restartCount,
    windowStart:  new Date(e.windowStart).toISOString(),
    classAttempts: Object.fromEntries(e.classCounts),
  };
}
