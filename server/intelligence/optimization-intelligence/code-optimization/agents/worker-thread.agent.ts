import type {
  FunctionProfile,
  CpuMetric,
  OptimizationFinding,
  ImpactLevel,
} from "../../types.js";
import { CPU_HIGH_PCT }                          from "../../types.js";
import { impactToScore, makeFindingId, nextSeq } from "../../utils/scoring.util.js";

const CATEGORY = "WORKER_THREAD" as const;
const MIN_LINE_COUNT     = 10;
const HIGH_FREQ_CALLS    = 20;

function isWorkerCandidate(fn: Readonly<FunctionProfile>): boolean {
  return (
    fn.hasLoops &&
    fn.lineCount >= MIN_LINE_COUNT &&
    fn.callFrequency >= 1
  );
}

function classifyWorkerImpact(
  fn:  Readonly<FunctionProfile>,
  cpu: Readonly<CpuMetric>,
): ImpactLevel {
  const highCpu = cpu.usagePercent >= CPU_HIGH_PCT;

  if (highCpu && fn.callFrequency > HIGH_FREQ_CALLS) return "CRITICAL";
  if (highCpu || fn.callFrequency > HIGH_FREQ_CALLS) return "HIGH";
  if (fn.callFrequency > 5)                          return "MEDIUM";
  return "LOW";
}

export function recommendWorkerThreads(
  functions: readonly Readonly<FunctionProfile>[],
  cpu:       Readonly<CpuMetric>,
): readonly OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];

  for (const fn of functions) {
    if (!isWorkerCandidate(fn)) continue;

    const impact = classifyWorkerImpact(fn, cpu);

    findings.push(Object.freeze({
      findingId:   makeFindingId("wt", nextSeq()),
      category:    CATEGORY,
      target:      `function:${fn.name}`,
      description: `Function "${fn.name}" is a heavy compute candidate (${fn.lineCount} lines, ${fn.callFrequency} calls/s). Offload to a Worker Thread to free the event loop.`,
      impact,
      score:       impactToScore(impact),
      evidence:    Object.freeze([
        `lineCount: ${fn.lineCount}`,
        `hasLoops: ${fn.hasLoops}`,
        `callFrequency: ${fn.callFrequency}`,
        `cpuUsage: ${cpu.usagePercent.toFixed(1)}%`,
      ]),
    }));
  }

  return Object.freeze(findings);
}
