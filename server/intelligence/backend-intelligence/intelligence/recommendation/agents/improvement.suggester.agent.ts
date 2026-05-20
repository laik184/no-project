import type { ImprovementSuggestion, RecommendationCandidate, RecommendationImpact } from "../types.js";

function capitalize(value: string): string {
  if (!value) return "";
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const SECURITY_TITLES: Readonly<Record<RecommendationImpact, string>> = Object.freeze({
  CRITICAL: "Eliminate critical security exposure",
  HIGH:     "Harden authentication and authorization controls",
  MEDIUM:   "Strengthen input validation and data protection",
  LOW:      "Apply security hygiene improvements",
});

const PERFORMANCE_TITLES: Readonly<Record<RecommendationImpact, string>> = Object.freeze({
  CRITICAL: "Resolve blocking performance bottleneck",
  HIGH:     "Eliminate N+1 queries and implement caching",
  MEDIUM:   "Optimize hot-path response time",
  LOW:      "Apply startup and payload size optimizations",
});

const ARCHITECTURE_TITLES: Readonly<Record<RecommendationImpact, string>> = Object.freeze({
  CRITICAL: "Break circular dependency and restore module isolation",
  HIGH:     "Decompose god module and enforce single responsibility",
  MEDIUM:   "Extract cross-cutting concerns into dedicated adapters",
  LOW:      "Clarify module boundaries and align naming conventions",
});

const SECURITY_DESCRIPTIONS: Readonly<Record<RecommendationImpact, string>> = Object.freeze({
  CRITICAL: "An unprotected attack surface has been identified. Apply multi-layer protection: schema validation, authentication enforcement, rate-limiting, and audit logging.",
  HIGH:     "Authorization or authentication gaps expose privileged operations. Enforce role-based access control, validate JWT claims on every route, and add CSRF protection.",
  MEDIUM:   "Partially protected inputs or loose CORS settings create exploitable attack vectors. Tighten validation schemas and origin restrictions.",
  LOW:      "Minor security hygiene issues increase the attack surface over time. Remove debug endpoints, scrub log output, and add security headers.",
});

const PERFORMANCE_DESCRIPTIONS: Readonly<Record<RecommendationImpact, string>> = Object.freeze({
  CRITICAL: "Blocking I/O or N+1 patterns inside critical paths are causing severe latency spikes. Use batching, async queues, and connection pooling immediately.",
  HIGH:     "Repeated database reads in loop constructs inflate response times. Replace with DataLoader patterns, indexed JOIN queries, and result-level caching.",
  MEDIUM:   "Synchronous operations inside request handlers reduce throughput. Offload heavy tasks to background workers and cache stable responses.",
  LOW:      "Uncompressed responses and eager module loading inflate startup and payload sizes. Apply gzip, code-split, and lazy-load non-critical paths.",
});

const ARCHITECTURE_DESCRIPTIONS: Readonly<Record<RecommendationImpact, string>> = Object.freeze({
  CRITICAL: "Circular import chains prevent tree-shaking, block safe refactoring, and indicate tightly coupled design. Extract shared contracts into a dedicated shared module immediately.",
  HIGH:     "Oversized modules with mixed responsibilities create change-amplification risk. Decompose by applying the Single Responsibility Principle and wire via interfaces.",
  MEDIUM:   "Cross-cutting logic embedded in domain services increases duplication risk. Extract to dedicated adapter layers and inject as dependencies.",
  LOW:      "Inconsistent naming and unclear module structure slow onboarding. Align with established naming conventions and document the intended architecture.",
});

function buildTitle(candidate: RecommendationCandidate): string {
  const label = capitalize(candidate.subject);
  const impact = candidate.impact;
  const suffix = `: ${label}`;

  switch (candidate.category) {
    case "security":     return SECURITY_TITLES[impact] + suffix;
    case "performance":  return PERFORMANCE_TITLES[impact] + suffix;
    default:             return ARCHITECTURE_TITLES[impact] + suffix;
  }
}

function buildDescription(candidate: RecommendationCandidate): string {
  const impact = candidate.impact;
  switch (candidate.category) {
    case "security":     return SECURITY_DESCRIPTIONS[impact];
    case "performance":  return PERFORMANCE_DESCRIPTIONS[impact];
    default:             return ARCHITECTURE_DESCRIPTIONS[impact];
  }
}

export function suggestImprovements(
  candidates: readonly RecommendationCandidate[],
): readonly ImprovementSuggestion[] {
  return Object.freeze(
    candidates.map((candidate) =>
      Object.freeze({
        subject: candidate.subject,
        title: buildTitle(candidate),
        description: buildDescription(candidate),
        category: candidate.category,
      }),
    ),
  );
}
