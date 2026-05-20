import type {
  MemoryMetric,
  OptimizationFinding,
  ImpactLevel,
} from "../../types.js";
import {
  MEMORY_HIGH_PCT,
  MEMORY_CRITICAL_PCT,
} from "../../types.js";
import { impactToScore, makeFindingId, nextSeq } from "../../utils/scoring.util.js";

const CATEGORY = "MEMORY_PATTERN" as const;

function heapUsageRatio(m: Readonly<MemoryMetric>): number {
  if (m.heapTotalMb <= 0) return 0;
  return m.heapUsedMb / m.heapTotalMb;
}

function classifyHeapRatio(ratio: number): ImpactLevel {
  if (ratio >= MEMORY_CRITICAL_PCT) return "CRITICAL";
  if (ratio >= MEMORY_HIGH_PCT)     return "HIGH";
  if (ratio >= 0.60)                return "MEDIUM";
  return "LOW";
}

function analyzeHeapPressure(
  m: Readonly<MemoryMetric>,
): OptimizationFinding | null {
  const ratio = heapUsageRatio(m);
  if (ratio < 0.60) return null;

  const impact = classifyHeapRatio(ratio);
  const pct    = (ratio * 100).toFixed(1);

  return Object.freeze({
    findingId:   makeFindingId("mem-heap", nextSeq()),
    category:    CATEGORY,
    target:      "runtime.memory.heap",
    description: `Heap utilization at ${pct}%. ${
      impact === "CRITICAL"
        ? "Memory exhaustion risk — review object retention and large allocations."
        : impact === "HIGH"
        ? "High heap usage — check for memory leaks or unbounded caches."
        : "Moderate heap usage — monitor growth trends."
    }`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([
      `Heap used: ${m.heapUsedMb.toFixed(1)}MB`,
      `Heap total: ${m.heapTotalMb.toFixed(1)}MB`,
      `Utilization: ${pct}%`,
    ]),
  });
}

function analyzeRssOverhead(
  m: Readonly<MemoryMetric>,
): OptimizationFinding | null {
  if (m.rssMb <= 0 || m.heapTotalMb <= 0) return null;

  const overhead = m.rssMb - m.heapTotalMb;
  if (overhead < 100) return null;

  const impact: ImpactLevel = overhead > 500 ? "HIGH" : "MEDIUM";

  return Object.freeze({
    findingId:   makeFindingId("mem-rss", nextSeq()),
    category:    CATEGORY,
    target:      "runtime.memory.rss",
    description: `RSS overhead of ${overhead.toFixed(1)}MB beyond heap total suggests high native or external memory usage.`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([
      `RSS: ${m.rssMb.toFixed(1)}MB`,
      `Heap total: ${m.heapTotalMb.toFixed(1)}MB`,
      `Overhead: ${overhead.toFixed(1)}MB`,
    ]),
  });
}

function analyzeExternalMemory(
  m: Readonly<MemoryMetric>,
): OptimizationFinding | null {
  if (m.externalMb < 50) return null;

  const impact: ImpactLevel = m.externalMb > 200 ? "HIGH" : "MEDIUM";

  return Object.freeze({
    findingId:   makeFindingId("mem-ext", nextSeq()),
    category:    CATEGORY,
    target:      "runtime.memory.external",
    description: `External memory usage of ${m.externalMb.toFixed(1)}MB detected — review Buffer and native addon usage.`,
    impact,
    score:       impactToScore(impact),
    evidence:    Object.freeze([`External MB: ${m.externalMb.toFixed(1)}`]),
  });
}

export function analyzeMemoryPatterns(
  memory: Readonly<MemoryMetric>,
): readonly OptimizationFinding[] {
  const findings: OptimizationFinding[] = [];

  const heap = analyzeHeapPressure(memory);
  if (heap) findings.push(heap);

  const rss = analyzeRssOverhead(memory);
  if (rss) findings.push(rss);

  const ext = analyzeExternalMemory(memory);
  if (ext) findings.push(ext);

  return Object.freeze(findings);
}
