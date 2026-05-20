import type { SelfImprovementInput, Bottleneck } from "../types";
import type { PerformanceAnalysis } from "../types";
import { linearScore } from "../utils/scoring.util";

export interface BottleneckDetectorOutput {
  success: boolean;
  logs: string[];
  error?: string;
  bottlenecks?: Bottleneck[];
}

interface ThresholdRule {
  area: string;
  metric: string;
  getValue: (input: SelfImprovementInput) => number;
  threshold: number;
  higherIsBad: boolean;
  severity: (delta: number) => Bottleneck["severity"];
}

const RULES: ThresholdRule[] = [
  {
    area: "latency",
    metric: "latencyMs",
    getValue: (i) => i.metrics.latencyMs,
    threshold: 300,
    higherIsBad: true,
    severity: (delta) => (delta > 3000 ? "critical" : delta > 1000 ? "high" : delta > 300 ? "medium" : "low"),
  },
  {
    area: "error-rate",
    metric: "errorRate",
    getValue: (i) => i.metrics.errorRate,
    threshold: 0.02,
    higherIsBad: true,
    severity: (delta) => (delta > 0.20 ? "critical" : delta > 0.10 ? "high" : delta > 0.05 ? "medium" : "low"),
  },
  {
    area: "success-rate",
    metric: "successRate",
    getValue: (i) => i.metrics.successRate,
    threshold: 0.95,
    higherIsBad: false,
    severity: (delta) => (delta < 0.70 ? "critical" : delta < 0.80 ? "high" : delta < 0.90 ? "medium" : "low"),
  },
  {
    area: "memory",
    metric: "memoryUsageMb",
    getValue: (i) => i.metrics.memoryUsageMb,
    threshold: 512,
    higherIsBad: true,
    severity: (delta) => (delta > 1500 ? "critical" : delta > 1000 ? "high" : delta > 512 ? "medium" : "low"),
  },
  {
    area: "cpu",
    metric: "cpuPercent",
    getValue: (i) => i.metrics.cpuPercent,
    threshold: 60,
    higherIsBad: true,
    severity: (delta) => (delta > 95 ? "critical" : delta > 85 ? "high" : delta > 70 ? "medium" : "low"),
  },
];

export function detectBottlenecks(
  input: SelfImprovementInput,
  analysis: PerformanceAnalysis
): BottleneckDetectorOutput {
  const logs: string[] = [];

  try {
    const bottlenecks: Bottleneck[] = [];

    for (const rule of RULES) {
      const current = rule.getValue(input);
      const violated = rule.higherIsBad
        ? current > rule.threshold
        : current < rule.threshold;

      if (!violated) continue;

      const delta = rule.higherIsBad
        ? current - rule.threshold
        : rule.threshold - current;

      const impactScore = linearScore(
        delta,
        0,
        rule.higherIsBad ? rule.threshold * 10 : rule.threshold,
        false
      );

      const b: Bottleneck = {
        area: rule.area,
        severity: rule.severity(current),
        metric: rule.metric,
        currentValue: Math.round(current * 1000) / 1000,
        thresholdValue: rule.threshold,
        impactScore: Math.max(impactScore, 10),
      };
      bottlenecks.push(b);
      logs.push(`[bottleneck-detector] ${rule.area}: current=${current} threshold=${rule.threshold} severity=${b.severity} impact=${b.impactScore}`);
    }

    if (input.validationResult && input.validationResult.score < 60) {
      const impactScore = linearScore(input.validationResult.score, 0, 60, true);
      bottlenecks.push({
        area: "validation-quality",
        severity: input.validationResult.score < 30 ? "critical" : "high",
        metric: "validationScore",
        currentValue: input.validationResult.score,
        thresholdValue: 60,
        impactScore,
      });
      logs.push(`[bottleneck-detector] validation quality below threshold: score=${input.validationResult.score}`);
    }

    if (input.recoveryHistory && input.recoveryHistory.length > 0) {
      const failCount = input.recoveryHistory.filter((r) => !r.resolved).length;
      if (failCount > 0) {
        const impactScore = Math.min(100, failCount * 15);
        bottlenecks.push({
          area: "recovery-failures",
          severity: failCount > 5 ? "critical" : failCount > 2 ? "high" : "medium",
          metric: "unresolvedFailures",
          currentValue: failCount,
          thresholdValue: 0,
          impactScore,
        });
        logs.push(`[bottleneck-detector] unresolved recovery failures: count=${failCount}`);
      }
    }

    bottlenecks.sort((a, b) => b.impactScore - a.impactScore);
    logs.push(`[bottleneck-detector] detected ${bottlenecks.length} bottleneck(s). overall perf=${analysis.overallScore}`);

    return { success: true, logs, bottlenecks };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[bottleneck-detector] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
