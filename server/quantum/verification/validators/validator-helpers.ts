/**
 * server/quantum/verification/validators/validator-helpers.ts
 *
 * Shared types, error class, and bus-emit helper for all parallel
 * validators. Imported by each category-validator to avoid duplication
 * and prevent circular dependencies.
 */

import { bus } from "../../../infrastructure/events/bus.ts";

// ── Error type ─────────────────────────────────────────────────────────────────

export class ParallelValidationError extends Error {
  constructor(
    public readonly category: ValidationCategory,
    public readonly code:     string,
    message:                  string,
  ) {
    super(`[parallel-validator] ${category}:${code} — ${message}`);
    this.name = "ParallelValidationError";
  }
}

// ── Shared types ───────────────────────────────────────────────────────────────

export type ValidationCategory =
  | "aggregation"
  | "worker"
  | "memory"
  | "graph"
  | "lock"
  | "runtime";

export interface ValidationResult {
  passed:     boolean;
  category:   ValidationCategory;
  checks:     ValidationCheck[];
  durationMs: number;
}

export interface ValidationCheck {
  name:    string;
  passed:  boolean;
  detail?: string;
}

// ── Shared bus helper ──────────────────────────────────────────────────────────

export function emitValidation(
  runId:    string,
  category: ValidationCategory,
  passed:   boolean,
  checks:   ValidationCheck[],
): void {
  bus.emit("agent.event", {
    runId,
    eventType: "parallel.validation" as any,
    phase:     "parallel-validator",
    ts:        Date.now(),
    payload:   { category, passed, checks },
  });
}
