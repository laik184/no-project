/**
 * server/engine/reflection/reflection-memory.ts
 *
 * Failure fingerprint memory for the Reflection Engine.
 *
 * Single responsibility: remember past reflection outcomes by fingerprint
 * so future reflections avoid repeating failed strategies.
 *
 * Design:
 *   - Per-project ring buffer (max 30 entries)
 *   - Fingerprint = hash of (failureClass + top 3 evidence snippets)
 *   - "Was this exact failure pattern tried before?" fast lookup
 *   - "What strategies succeeded?" recall for confident decisions
 *
 * In-memory only. Cross-session persistence is handled by
 * server/debug/memory/recovery-memory.ts (crash recovery history).
 */

import type { ReflectionFailureClass, ReflectionDecisionType, ReflectionMemoryEntry } from "./reflection-types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_ENTRIES_PER_PROJECT = 30;

// ── State ─────────────────────────────────────────────────────────────────────

const _memory = new Map<number, ReflectionMemoryEntry[]>();

// ── Fingerprinting ────────────────────────────────────────────────────────────

/**
 * Build a stable fingerprint from failure class + evidence snippets.
 * Simple and deterministic — no crypto needed for this use case.
 */
function buildFingerprint(
  failureClass: ReflectionFailureClass,
  evidence:     string[],
): string {
  const evidenceKey = evidence
    .slice(0, 3)
    .map((e) => e.slice(0, 80).toLowerCase().replace(/\s+/g, " ").trim())
    .join("|");
  return `${failureClass}::${evidenceKey}`;
}

function getOrCreate(projectId: number): ReflectionMemoryEntry[] {
  if (!_memory.has(projectId)) _memory.set(projectId, []);
  return _memory.get(projectId)!;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check if this exact failure pattern has been seen before.
 * Returns the matching entry if found, undefined otherwise.
 */
export function recall(
  projectId:    number,
  failureClass: ReflectionFailureClass,
  evidence:     string[],
): ReflectionMemoryEntry | undefined {
  const fp      = buildFingerprint(failureClass, evidence);
  const entries = _memory.get(projectId) ?? [];
  return entries.find((e) => e.fingerprint === fp);
}

/**
 * Record a reflection outcome for future memory lookups.
 * Ring-buffer: oldest entries evicted when limit reached.
 */
export function remember(
  projectId:    number,
  failureClass: ReflectionFailureClass,
  evidence:     string[],
  decision:     ReflectionDecisionType,
  outcome:      "success" | "failure" | "pending",
): void {
  const fp      = buildFingerprint(failureClass, evidence);
  const entries = getOrCreate(projectId);

  // Update existing if fingerprint already recorded
  const existing = entries.find((e) => e.fingerprint === fp);
  if (existing) {
    existing.outcome  = outcome;
    existing.decision = decision;
    existing.ts       = Date.now();
    existing.attempts++;
    return;
  }

  // Ring-buffer eviction
  if (entries.length >= MAX_ENTRIES_PER_PROJECT) {
    entries.shift();
  }

  entries.push({
    fingerprint:  fp,
    failureClass,
    decision,
    outcome,
    ts:           Date.now(),
    attempts:     1,
  });
}

/**
 * Update the outcome of a previously recorded entry.
 * Call after the patch/retry result is known.
 */
export function updateOutcome(
  projectId:    number,
  failureClass: ReflectionFailureClass,
  evidence:     string[],
  outcome:      "success" | "failure",
): void {
  const fp      = buildFingerprint(failureClass, evidence);
  const entries = _memory.get(projectId) ?? [];
  const entry   = entries.find((e) => e.fingerprint === fp);
  if (entry) {
    entry.outcome = outcome;
    entry.ts      = Date.now();
  }
}

/**
 * What strategies succeeded for this project? Useful for confidence boosting.
 */
export function successfulStrategies(projectId: number): ReflectionDecisionType[] {
  const entries = _memory.get(projectId) ?? [];
  return [...new Set(
    entries
      .filter((e) => e.outcome === "success")
      .map((e) => e.decision)
  )];
}

/** Diagnostic: full memory for a project. */
export function memorySnapshot(projectId: number): ReflectionMemoryEntry[] {
  return [...(_memory.get(projectId) ?? [])];
}

/** Clear memory for a project (e.g. on clean successful run). */
export function clearMemory(projectId: number): void {
  _memory.delete(projectId);
}
