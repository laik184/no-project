import { CorrelationResult, SynthesizedInsight } from "../types";

export class InsightSynthesizerAgent {
  synthesize(correlations: CorrelationResult): SynthesizedInsight[] {
    const insights: SynthesizedInsight[] = [];

    for (const [signalId, relatedIds] of Object.entries(
      correlations.correlations
    )) {
      if (relatedIds.length > 0) {
        insights.push({
          sourceSignal: signalId,
          relatedSignals: relatedIds,
          summary: `Signal ${signalId} correlates with ${relatedIds.length} related signal(s).`,
          confidence: Math.min(1, relatedIds.length * 0.25),
        });
      }
    }

    return insights;
  }
}
