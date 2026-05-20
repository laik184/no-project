import { CrossIntelligenceInput, CorrelationResult } from "../types";

export class CorrelationEngineAgent {
  correlate(input: CrossIntelligenceInput): CorrelationResult {
    const signals = input.signals ?? [];
    const correlations: Record<string, string[]> = {};

    for (const signal of signals) {
      const related = signals
        .filter((s) => s.category === signal.category && s.id !== signal.id)
        .map((s) => s.id);
      if (related.length > 0) {
        correlations[signal.id] = related;
      }
    }

    return { correlations };
  }
}
