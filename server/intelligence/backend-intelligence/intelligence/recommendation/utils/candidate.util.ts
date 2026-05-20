import type {
  PrioritySignal,
  RecommendationCandidate,
  RecommendationInput,
} from "../types.js";

// ── Candidate enrichment pipeline ─────────────────────────────────────────────
//
// All logic for enriching, filtering, and ordering RecommendationCandidates
// lives here. The orchestrator should only call these functions in sequence —
// never contain this processing logic directly.

const DEFAULT_PRIORITY = 50;
const MIN_PRIORITY     = 0;
const MAX_PRIORITY     = 100;

// ── Priority normalization ────────────────────────────────────────────────────

export function normalizePriority(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return DEFAULT_PRIORITY;
  }

  if (value < MIN_PRIORITY) return MIN_PRIORITY;
  if (value > MAX_PRIORITY) return MAX_PRIORITY;

  return Math.round(value);
}

// ── Input → lookup-map transforms ────────────────────────────────────────────

export function toPriorityMap(
  priorities: readonly PrioritySignal[] | undefined,
): ReadonlyMap<string, number> {
  if (!priorities || priorities.length === 0) return new Map();

  const entries = priorities.map(
    (item) => [item.subject, normalizePriority(item.priority)] as const,
  );

  return new Map(entries);
}

export function toTruthMap(
  input: RecommendationInput,
): ReadonlyMap<string, "OK" | "NOT_OK" | "UNKNOWN"> {
  const truths = input.consistency?.finalTruth ?? [];
  return new Map(truths.map((truth) => [truth.subject, truth.status] as const));
}

// ── Candidate transforms ──────────────────────────────────────────────────────

export function applyPriority(
  candidates:  readonly RecommendationCandidate[],
  priorityMap: ReadonlyMap<string, number>,
): readonly RecommendationCandidate[] {
  return Object.freeze(
    candidates.map((candidate) =>
      Object.freeze({
        ...candidate,
        priority: normalizePriority(
          priorityMap.get(candidate.subject) ?? candidate.priority,
        ),
      }),
    ),
  );
}

export function applyConsistency(
  candidates: readonly RecommendationCandidate[],
  truthMap:   ReadonlyMap<string, "OK" | "NOT_OK" | "UNKNOWN">,
): readonly RecommendationCandidate[] {
  return Object.freeze(
    candidates.filter((candidate) => {
      const status = truthMap.get(candidate.subject);
      return !status || status !== "OK";
    }),
  );
}

export function sortByPriority(
  candidates: readonly RecommendationCandidate[],
): readonly RecommendationCandidate[] {
  return Object.freeze(
    [...candidates].sort(
      (a, b) => b.priority - a.priority || a.subject.localeCompare(b.subject),
    ),
  );
}
