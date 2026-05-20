import type { SelfImprovementInput, PerformanceAnalysis } from "../types";
import {
  normalizeLatency,
  normalizeErrorRate,
  normalizeMemory,
  normalizeCpu,
  scaleTo100,
} from "../utils/normalization.util";
import { weightedAverage } from "../utils/scoring.util";

export interface PerformanceAnalyzerOutput {
  success: boolean;
  logs: string[];
  error?: string;
  analysis?: PerformanceAnalysis;
}

export function analyzePerformance(input: SelfImprovementInput): PerformanceAnalyzerOutput {
  const logs: string[] = [];

  try {
    const { metrics } = input;
    logs.push(`[performance-analyzer] latency=${metrics.latencyMs}ms error_rate=${metrics.errorRate} success_rate=${metrics.successRate}`);

    const latencyScore = scaleTo100(normalizeLatency(metrics.latencyMs));
    const reliabilityScore = scaleTo100(normalizeErrorRate(metrics.errorRate));
    const resourceScore = scaleTo100(
      weightedAverage([
        { value: normalizeMemory(metrics.memoryUsageMb), weight: 0.5 },
        { value: normalizeCpu(metrics.cpuPercent), weight: 0.5 },
      ])
    );
    const efficiencyScore = scaleTo100(
      weightedAverage([
        { value: normalizeLatency(metrics.latencyMs), weight: 0.4 },
        { value: metrics.successRate, weight: 0.4 },
        { value: normalizeErrorRate(metrics.errorRate), weight: 0.2 },
      ])
    );

    const overallScore = scaleTo100(
      weightedAverage([
        { value: latencyScore / 100, weight: 0.35 },
        { value: reliabilityScore / 100, weight: 0.30 },
        { value: resourceScore / 100, weight: 0.20 },
        { value: efficiencyScore / 100, weight: 0.15 },
      ])
    );

    const warnings: string[] = [];
    if (metrics.latencyMs > 1000) warnings.push(`High latency: ${metrics.latencyMs}ms`);
    if (metrics.errorRate > 0.05) warnings.push(`Error rate above 5%: ${(metrics.errorRate * 100).toFixed(1)}%`);
    if (metrics.successRate < 0.90) warnings.push(`Success rate below 90%: ${(metrics.successRate * 100).toFixed(1)}%`);
    if (metrics.memoryUsageMb > 1024) warnings.push(`High memory usage: ${metrics.memoryUsageMb}MB`);
    if (metrics.cpuPercent > 80) warnings.push(`High CPU usage: ${metrics.cpuPercent}%`);

    logs.push(`[performance-analyzer] overall=${overallScore} latency=${latencyScore} reliability=${reliabilityScore} resource=${resourceScore} efficiency=${efficiencyScore}`);
    if (warnings.length > 0) logs.push(`[performance-analyzer] warnings: ${warnings.join("; ")}`);

    const analysis: PerformanceAnalysis = {
      efficiencyScore,
      latencyScore,
      reliabilityScore,
      resourceScore,
      overallScore,
      warnings,
    };

    return { success: true, logs, analysis };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`[performance-analyzer] ERROR: ${message}`);
    return { success: false, logs, error: message };
  }
}
