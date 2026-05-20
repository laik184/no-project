export type RecommendationImpact = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RecommendationCategory = "performance" | "security" | "architecture";

// ── Canonical runtime enumerations (single source of truth) ──────────────────
// Ordered by descending severity / priority so consumers can use indexOf() for
// comparison without maintaining their own local arrays.

export const ALL_RECOMMENDATION_IMPACTS: readonly RecommendationImpact[] = Object.freeze([
  "CRITICAL", "HIGH", "MEDIUM", "LOW",
]);

export const ALL_RECOMMENDATION_CATEGORIES: readonly RecommendationCategory[] = Object.freeze([
  "security", "performance", "architecture",
]);

export interface AnalysisFinding {
  readonly id?: string;
  readonly subject: string;
  readonly message: string;
  readonly category?: RecommendationCategory;
  readonly impact?: RecommendationImpact;
  readonly severity?: RecommendationImpact;
  readonly evidence?: readonly string[];
  readonly tags?: readonly string[];
}

export interface AnalysisResult {
  readonly findings: readonly AnalysisFinding[];
}

export interface PrioritySignal {
  readonly subject: string;
  readonly priority: number;
}

export interface PriorityOutput {
  readonly priorities: readonly PrioritySignal[];
}

export interface ConsistencyTruth {
  readonly subject: string;
  readonly status: "OK" | "NOT_OK" | "UNKNOWN";
  readonly severity: RecommendationImpact;
}

export interface ConsistencyOutput {
  readonly finalTruth: readonly ConsistencyTruth[];
}

export interface RecommendationContext {
  readonly domain?: string;
  readonly environment?: string;
  readonly constraints?: readonly string[];
}

export interface RecommendationInput {
  readonly analysis?: AnalysisResult;
  readonly priority?: PriorityOutput;
  readonly consistency?: ConsistencyOutput;
  readonly context?: RecommendationContext;
}

export interface RecommendationCandidate {
  readonly subject: string;
  readonly message: string;
  readonly category: RecommendationCategory;
  readonly impact: RecommendationImpact;
  readonly priority: number;
  readonly evidence: readonly string[];
}

export interface ImprovementSuggestion {
  readonly subject: string;
  readonly title: string;
  readonly description: string;
  readonly category: RecommendationCategory;
}

export interface FixRecommendation {
  readonly subject: string;
  readonly steps: readonly string[];
}

export interface GeneratedAction {
  readonly subject: string;
  readonly action: string;
}

export interface Recommendation {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly action: string;
  readonly impact: RecommendationImpact;
  readonly category: RecommendationCategory;
  readonly priority: number;
  readonly steps: readonly string[];
  readonly explanation: string;
}

export interface RecommendationResponse {
  readonly total: number;
  readonly recommendations: readonly Recommendation[];
}
