import type {
  EndpointProfile,
  RuntimeMetric,
  OptimizationFinding,
  ImpactLevel,
} from "../../types.js";
import {
  LATENCY_HIGH_MS,
  LATENCY_CRITICAL_MS,
} from "../../types.js";
import { impactToScore, makeFindingId, nextSeq } from "../../utils/scoring.util.js";

const CATEGORY = "LATENCY_PATTERN" as const;

function classifyLatency(ms: number): ImpactLevel {
  if (ms >= LATENCY_CRITICAL_MS) return "CRITICAL";
  if (ms >= LATENCY_HIGH_MS)     return "HIGH";
  if (ms >= 200)                 return "MEDIUM";
  return "LOW";
}

function analyzeEndpoint(
  ep: Readonly<EndpointProfile>,
): OptimizationFinding | null {
  const worst = Math.max(ep.avgLatencyMs, ep.p99LatencyMs);
  if (worst < 200) return null;

  const impact = classifyLatency(worst);

  const evidence: string[] = [
    `Route: ${ep.method} ${ep.route}`,
    `Avg latency: ${ep.avgLatencyMs}ms`,
    `P99 latency: ${ep.p99LatencyMs}ms`,
    `Call count: ${ep.callCount}`,
  ];

  if (ep.errorRate > 0) {
    evidence.push(`Error rate: ${(ep.errorRate * 100).toFixed(1)}%`);
  }

  const suggestion =
    worst >= LATENCY_CRITICAL_MS
      ? `Critical latency on ${ep.method} ${ep.route} (${worst}ms). Add caching, optimize DB queries, or use async processing.`
      : worst >= LATENCY_HIGH_MS
      ? `High latency on ${ep.method} ${ep.route} (${worst}ms). Profile handler and consider response caching.`
      : `Elevated latency on ${ep.method} ${ep.route} (${worst}ms). Review synchronous operations in handler.`;

  return Object.freeze({
    findingId:   makeFindingId("lat-ep", nextSeq()),
    category:    CATEGORY,
    target:      `${ep.method}:${ep.route}`,
    description: suggestion,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze(evidence),
  });
}

function analyzeRuntimeMetric(
  metric: Readonly<RuntimeMetric>,
): OptimizationFinding | null {
  if (metric.valueMs <= metric.threshold) return null;

  const ratio  = metric.valueMs / metric.threshold;
  const impact: ImpactLevel =
    ratio >= 4   ? "CRITICAL"
    : ratio >= 2 ? "HIGH"
    : ratio >= 1.5 ? "MEDIUM"
    : "LOW";

  return Object.freeze({
    findingId:   makeFindingId("lat-met", nextSeq()),
    category:    CATEGORY,
    target:      `metric:${metric.name}`,
    description: `Metric "${metric.name}" exceeded threshold by ${((ratio - 1) * 100).toFixed(0)}% (${metric.valueMs}ms vs ${metric.threshold}ms limit).`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([
      `Measured: ${metric.valueMs}ms`,
      `Threshold: ${metric.threshold}ms`,
      `Ratio: ${ratio.toFixed(2)}x`,
    ]),
  });
}

export function analyzeLatencyPatterns(
  endpoints: readonly Readonly<EndpointProfile>[],
  metrics:   readonly Readonly<RuntimeMetric>[],
): readonly OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];

  for (const ep of endpoints) {
    const f = analyzeEndpoint(ep);
    if (f) findings.push(f);
  }

  for (const m of metrics) {
    const f = analyzeRuntimeMetric(m);
    if (f) findings.push(f);
  }

  return Object.freeze(findings);
}
