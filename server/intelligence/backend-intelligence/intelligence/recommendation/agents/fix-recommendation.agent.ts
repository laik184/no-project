import type { FixRecommendation, RecommendationCandidate, RecommendationImpact } from "../types.js";

const SECURITY_STEPS: Readonly<Record<RecommendationImpact, readonly string[]>> = Object.freeze({
  CRITICAL: Object.freeze([
    "Immediately rotate all credentials and secrets referenced by the affected module.",
    "Apply parameterized queries or prepared statements to eliminate injection surface.",
    "Enforce authentication middleware on every route in the affected controller.",
    "Add schema validation (e.g., Zod/Joi) for all request body, query, and param fields.",
    "Run SAST scanner against the patched code and fix all HIGH/CRITICAL findings before merge.",
  ]),
  HIGH: Object.freeze([
    "Add explicit input validation and schema checks for all entry points.",
    "Enforce least-privilege authorization — verify role claims on every protected operation.",
    "Enable CORS with an explicit allowlist; remove wildcard origins.",
    "Add security regression tests covering abuse scenarios (SQL injection, privilege escalation, etc.).",
  ]),
  MEDIUM: Object.freeze([
    "Validate all request fields against a strict schema before processing.",
    "Review CORS configuration and tighten the origin allowlist.",
    "Sanitize user-supplied data before reflection in responses or logs.",
    "Add HTTP security headers (X-Content-Type-Options, X-Frame-Options, CSP).",
  ]),
  LOW: Object.freeze([
    "Remove all debug/dev-only endpoints from production builds.",
    "Scrub PII and credentials from log output using a structured logger config.",
    "Add a helmet-style middleware to apply security headers with sane defaults.",
  ]),
});

const PERFORMANCE_STEPS: Readonly<Record<RecommendationImpact, readonly string[]>> = Object.freeze({
  CRITICAL: Object.freeze([
    "Instrument the hot path with APM (e.g., OpenTelemetry) to measure current baseline.",
    "Replace all N+1 DB calls inside loops with a single batched query or DataLoader.",
    "Add a Redis cache layer with a TTL policy for the most-read data set.",
    "Move non-blocking operations to a background queue (BullMQ, pg-boss, etc.).",
    "Set up a load test to verify p95 latency target is met after changes.",
  ]),
  HIGH: Object.freeze([
    "Identify N+1 patterns using query-count assertions in integration tests.",
    "Replace sequential DB reads with batched queries using JOIN or IN clauses.",
    "Add database indices on the primary filter and foreign key columns.",
    "Profile memory allocation on the hot path and eliminate unnecessary object creation.",
  ]),
  MEDIUM: Object.freeze([
    "Add response caching with short TTL for high-read endpoints.",
    "Offload CPU-intensive work to a worker thread or background process.",
    "Enable connection pooling if direct DB connections are being opened per-request.",
  ]),
  LOW: Object.freeze([
    "Enable gzip/brotli compression in the HTTP server config.",
    "Lazy-load modules that are not needed at startup to reduce cold-start time.",
    "Use streaming for large file/data responses instead of buffering entire payloads.",
  ]),
});

const ARCHITECTURE_STEPS: Readonly<Record<RecommendationImpact, readonly string[]>> = Object.freeze({
  CRITICAL: Object.freeze([
    "Map all circular import chains and extract shared types into a dedicated shared/ module.",
    "Enforce one-directional import rules with ESLint import/no-cycle.",
    "Introduce interface types at each module boundary so consumers depend on abstractions.",
    "Add CI enforcement: fail build on any new circular dependency.",
    "Add contract/integration tests for each module boundary to protect the public surface.",
  ]),
  HIGH: Object.freeze([
    "Identify all distinct responsibilities in the oversized module using line-count and change-frequency analysis.",
    "Extract each responsibility into its own focused service or module.",
    "Wire dependencies through constructor injection or factory functions — never direct imports from peer layers.",
    "Add unit tests for each extracted service to verify isolated behavior.",
  ]),
  MEDIUM: Object.freeze([
    "Extract cross-cutting logic (logging, auth, error handling) into shared adapters.",
    "Define explicit TypeScript interfaces at each module boundary.",
    "Remove direct imports of internal files across module boundaries — use index.ts only.",
  ]),
  LOW: Object.freeze([
    "Rename files and exports to reflect their actual responsibility.",
    "Co-locate related types, validators, and constants in the module that owns them.",
    "Add a short architecture decision record (ADR) documenting the module's purpose and boundaries.",
  ]),
});

function buildSteps(candidate: RecommendationCandidate): readonly string[] {
  const impact = candidate.impact;
  switch (candidate.category) {
    case "security":    return SECURITY_STEPS[impact];
    case "performance": return PERFORMANCE_STEPS[impact];
    default:            return ARCHITECTURE_STEPS[impact];
  }
}

export function buildFixRecommendations(
  candidates: readonly RecommendationCandidate[],
): readonly FixRecommendation[] {
  return Object.freeze(
    candidates.map((candidate) =>
      Object.freeze({
        subject: candidate.subject,
        steps:   buildSteps(candidate),
      }),
    ),
  );
}
