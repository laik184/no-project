import type {
  CpuMetric,
  FunctionProfile,
  OptimizationFinding,
  ImpactLevel,
} from "../../types.js";
import {
  CPU_HIGH_PCT,
  CPU_CRITICAL_PCT,
} from "../../types.js";
import { impactToScore, makeFindingId, nextSeq } from "../../utils/scoring.util.js";

const CATEGORY = "CPU_PATTERN" as const;

function classifyCpuUsage(usagePercent: number): ImpactLevel {
  if (usagePercent >= CPU_CRITICAL_PCT) return "CRITICAL";
  if (usagePercent >= CPU_HIGH_PCT)     return "HIGH";
  if (usagePercent >= 50)               return "MEDIUM";
  return "LOW";
}

function analyzeCpuMetric(cpu: Readonly<CpuMetric>): OptimizationFinding | null {
  if (cpu.usagePercent < 50) return null;

  const impact  = classifyCpuUsage(cpu.usagePercent);
  const evidence: string[] = [
    `CPU usage: ${cpu.usagePercent.toFixed(1)}%`,
    `User time: ${cpu.userMs}ms`,
    `System time: ${cpu.systemMs}ms`,
  ];

  const suggestion =
    impact === "CRITICAL"
      ? "CPU usage is critically high. Offload compute to worker threads or scale horizontally."
      : impact === "HIGH"
      ? "CPU usage is elevated. Profile hot functions and consider async patterns or caching."
      : "CPU usage is moderate. Review synchronous compute blocks for optimization opportunities.";

  return Object.freeze({
    findingId:   makeFindingId("cpu", nextSeq()),
    category:    CATEGORY,
    target:      "runtime.cpu",
    description: suggestion,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze(evidence),
  });
}

function analyzeHeavyFunctions(
  functions: readonly Readonly<FunctionProfile>[],
): readonly OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];

  for (const fn of functions) {
    if (!fn.hasLoops || fn.callFrequency < 1) continue;

    const impact: ImpactLevel =
      fn.callFrequency > 100 ? "HIGH"
      : fn.callFrequency > 20 ? "MEDIUM"
      : "LOW";

    findings.push(Object.freeze({
      findingId:   makeFindingId("cpu-fn", nextSeq()),
      category:    CATEGORY,
      target:      `function:${fn.name}`,
      description: `Function "${fn.name}" contains loops and is called ${fn.callFrequency}x — potential CPU hotspot.`,
      impact,
      score:       impactToScore(impact),
      evidence:    Object.freeze([
        `Call frequency: ${fn.callFrequency}`,
        `Has loops: true`,
        `Line count: ${fn.lineCount}`,
      ]),
    }));
  }

  return Object.freeze(findings);
}

export function analyzeCpuPatterns(
  cpu:       Readonly<CpuMetric>,
  functions: readonly Readonly<FunctionProfile>[],
): readonly OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];

  const metric = analyzeCpuMetric(cpu);
  if (metric) findings.push(metric);

  findings.push(...analyzeHeavyFunctions(functions));

  return Object.freeze(findings);
}
