import type { Recommendation, RecommendationCandidate, RecommendationResponse } from "./types.js";

export interface RecommendationState {
  readonly candidates: readonly RecommendationCandidate[];
  readonly recommendations: readonly Recommendation[];
}

export function createEmptyRecommendationState(): RecommendationState {
  return Object.freeze({
    candidates: Object.freeze([]),
    recommendations: Object.freeze([]),
  });
}

export function withCandidates(
  state: RecommendationState,
  candidates: readonly RecommendationCandidate[],
): RecommendationState {
  return Object.freeze({
    ...state,
    candidates: Object.freeze([...candidates]),
  });
}

export function withRecommendations(
  state: RecommendationState,
  recommendations: readonly Recommendation[],
): RecommendationState {
  return Object.freeze({
    ...state,
    recommendations: Object.freeze([...recommendations]),
  });
}

export function toResponse(state: RecommendationState): RecommendationResponse {
  return Object.freeze({
    total: state.recommendations.length,
    recommendations: Object.freeze([...state.recommendations]),
  });
}
