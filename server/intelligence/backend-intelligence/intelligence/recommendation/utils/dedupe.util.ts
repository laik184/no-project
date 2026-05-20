import type { RecommendationCandidate } from "../types.js";

export function dedupeCandidates(
  candidates: readonly RecommendationCandidate[],
): readonly RecommendationCandidate[] {
  const seen = new Set<string>();
  const deduped: RecommendationCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.subject.toLowerCase()}|${candidate.message.toLowerCase()}|${candidate.category}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return Object.freeze(deduped);
}
