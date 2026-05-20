import type { ExecutionResult, ComparisonResult } from "../types";
import { compositeExperimentScore, latencyToSpeedScore, clamp } from "../utils/scoring.util";
import { normalizeLatencies, normalizeAccuracies } from "../utils/normalization.util";

export interface ComparatorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  comparisons?: ComparisonResult[];
}

export function compareResults(results: ExecutionResult[]): ComparatorOutput {
  const logs: string[] = [];
  try {
    logs.push(`[comparator] comparing ${results.length} result(s)`);

    if (results.length === 0) {
      return { success: true, logs, comparisons: [] };
    }

    const latencies = results.map((r) => r.latencyMs);
    const accuracies = results.map((r) => r.accuracyScore);

    const normLatencies = normalizeLatencies(latencies);
    const normAccuracies = normalizeAccuracies(accuracies);

    const allFailed = results.every((r) => !r.success);

    const comparisons: ComparisonResult[] = results.map((r, i) => {
      const rawSpeedScore = latencyToSpeedScore(r.latencyMs, 5000);
      const normLatency = normLatencies[i] ?? 0;
      const speedScore = clamp(rawSpeedScore * 0.6 + (1 - normLatency) * 0.4);

      const normAccuracy = normAccuracies[i] ?? 0;
      const accuracyScore = clamp(r.accuracyScore * 0.6 + normAccuracy * 0.4);

      const successRateScore = allFailed ? 0.1 : (r.success ? 0.9 + r.rawScore * 0.1 : r.rawScore * 0.4);

      const compositeScore = compositeExperimentScore(speedScore, accuracyScore, clamp(successRateScore));

      logs.push(
        `[comparator] ${r.variantId}: speed=${speedScore.toFixed(3)} accuracy=${accuracyScore.toFixed(3)} successRate=${successRateScore.toFixed(3)} composite=${compositeScore}`
      );

      return { variantId: r.variantId, speedScore, accuracyScore, successRateScore, compositeScore };
    });

    return { success: true, logs, comparisons };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[comparator] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
