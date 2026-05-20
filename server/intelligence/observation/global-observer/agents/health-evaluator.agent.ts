import type { SignalGroup, Anomaly, Trend } from "../types";
import { weightedAverage, scaleTo100, clamp } from "../utils/scoring.util";
import { normalizeLatency, normalizeSuccessRate } from "../utils/normalization.util";

export interface HealthEvaluatorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  healthScore?: number;
}

const SEVERITY_DEDUCTION: Record<string, number> = {
  critical: 20,
  high: 10,
  medium: 4,
  low: 1,
};

const TREND_DIRECTION_MODIFIER: Record<string, number> = {
  improving: 2,
  stable: 0,
  degrading: -3,
};

export function evaluateHealth(
  signals: SignalGroup[],
  anomalies: Anomaly[],
  trends: Trend[]
): HealthEvaluatorOutput {
  const logs: string[] = [];

  try {
    logs.push(`[health-evaluator] evaluating system health — modules=${signals.length} anomalies=${anomalies.length} trends=${trends.length}`);

    if (signals.length === 0) {
      logs.push(`[health-evaluator] no signals — returning neutral health score 50`);
      return { success: true, logs, healthScore: 50 };
    }

    const moduleScores: number[] = signals.map((sig) => {
      const latencyScore = normalizeLatency(sig.avgLatency);
      const successScore = normalizeSuccessRate(sig.successRate);

      const composite = weightedAverage([
        { value: latencyScore, weight: 0.40 },
        { value: successScore, weight: 0.60 },
      ]);

      return clamp(composite);
    });

    const avgModuleScore = moduleScores.reduce((s, v) => s + v, 0) / moduleScores.length;
    let baseScore = scaleTo100(avgModuleScore);

    logs.push(`[health-evaluator] base score from modules: ${baseScore}`);

    let anomalyDeduction = 0;
    for (const a of anomalies) {
      anomalyDeduction += SEVERITY_DEDUCTION[a.severity] ?? 0;
    }
    anomalyDeduction = Math.min(50, anomalyDeduction);
    baseScore -= anomalyDeduction;
    if (anomalyDeduction > 0) {
      logs.push(`[health-evaluator] anomaly deduction: -${anomalyDeduction} (${anomalies.length} anomaly(ies))`);
    }

    let trendModifier = 0;
    for (const t of trends) {
      trendModifier += TREND_DIRECTION_MODIFIER[t.direction] ?? 0;
    }
    trendModifier = Math.max(-10, Math.min(10, trendModifier));
    baseScore += trendModifier;
    if (trendModifier !== 0) {
      logs.push(`[health-evaluator] trend modifier: ${trendModifier > 0 ? "+" : ""}${trendModifier}`);
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));
    logs.push(`[health-evaluator] final health score: ${finalScore}/100`);

    return { success: true, logs, healthScore: finalScore };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[health-evaluator] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
