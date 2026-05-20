import type { GeneratedAction, RecommendationCandidate, RecommendationCategory, RecommendationImpact } from "../types.js";

interface ActionTemplate {
  readonly action: string;
}

type ActionMap = Readonly<Record<RecommendationCategory, Readonly<Record<RecommendationImpact, ActionTemplate>>>>;

const ACTION_MATRIX: ActionMap = Object.freeze({
  security: Object.freeze({
    CRITICAL: Object.freeze({
      action: "Immediately revoke all exposed credentials, patch the vulnerability, and run a full SAST + dependency audit before any re-deployment.",
    }),
    HIGH: Object.freeze({
      action: "Enforce strict input validation, apply least-privilege authorization checks, and add rate-limiting to all affected endpoints within this sprint.",
    }),
    MEDIUM: Object.freeze({
      action: "Add schema-level validation, tighten CORS policy, and review session/token handling for the affected module.",
    }),
    LOW: Object.freeze({
      action: "Add a hardened Content-Security-Policy header, remove debug logging from production paths, and document the security posture for this area.",
    }),
  }),
  performance: Object.freeze({
    CRITICAL: Object.freeze({
      action: "Enable query result caching with Redis or in-process LRU, replace sequential DB calls inside loops with batched queries or DataLoader, and set up APM tracing to confirm resolution.",
    }),
    HIGH: Object.freeze({
      action: "Batch all N+1 query patterns using joins or DataLoader, add database indices on the primary filter columns, and profile the hot path end-to-end.",
    }),
    MEDIUM: Object.freeze({
      action: "Move non-critical operations off the request thread using a background queue, add response caching with a short TTL for high-read endpoints.",
    }),
    LOW: Object.freeze({
      action: "Enable gzip compression for response payloads, lazy-load modules that are not needed at startup, and review middleware execution order.",
    }),
  }),
  architecture: Object.freeze({
    CRITICAL: Object.freeze({
      action: "Break circular dependency chains immediately — extract shared types into a dedicated shared module and enforce one-directional import rules via ESLint.",
    }),
    HIGH: Object.freeze({
      action: "Split the god module into focused services with single responsibilities, define explicit interface contracts between them, and wire via dependency injection.",
    }),
    MEDIUM: Object.freeze({
      action: "Extract cross-cutting concerns (logging, auth, error handling) into adapters, introduce a well-typed interface at each module boundary.",
    }),
    LOW: Object.freeze({
      action: "Rename modules to reflect their responsibility, co-locate related types and validators, and document the intended call direction in the module README.",
    }),
  }),
});

function buildAction(candidate: RecommendationCandidate): string {
  const categoryMap = ACTION_MATRIX[candidate.category];
  const template = categoryMap[candidate.impact];
  return `[${candidate.subject}] ${template.action}`;
}

export function generateActions(candidates: readonly RecommendationCandidate[]): readonly GeneratedAction[] {
  return Object.freeze(
    candidates.map((candidate) =>
      Object.freeze({
        subject: candidate.subject,
        action: buildAction(candidate),
      }),
    ),
  );
}
