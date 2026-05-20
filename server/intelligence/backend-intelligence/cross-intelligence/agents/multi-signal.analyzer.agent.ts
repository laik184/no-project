import { CrossIntelligenceInput, MultiSignalReport } from "../types";

export class MultiSignalAnalyzerAgent {
  analyze(input: CrossIntelligenceInput): MultiSignalReport {
    const signals = input.signals ?? [];
    const categoryMap: Record<string, number> = {};

    for (const signal of signals) {
      categoryMap[signal.category] = (categoryMap[signal.category] ?? 0) + 1;
    }

    const dominantCategory = Object.entries(categoryMap).sort(
      ([, a], [, b]) => b - a
    )[0]?.[0];

    return {
      totalSignals: signals.length,
      categoryBreakdown: categoryMap,
      dominantCategory: dominantCategory ?? "unknown",
    };
  }
}
