import type { ArchitectureAnalysisReport, PatternDetectionResult } from "../types.js";
import { derivePatternMetrics } from "../utils/dependency-graph.util.js";
import { inferPatternFromMetrics } from "../utils/pattern-map.util.js";

function detectAntiPatterns(report: Readonly<ArchitectureAnalysisReport>): readonly string[] {
  const antiPatterns = new Set<string>();

  for (const violation of report.violations) {
    const text = `${violation.type} ${violation.message}`.toLowerCase();

    if (text.includes("god module") || text.includes("god object")) {
      antiPatterns.add("god module");
    }
    if (text.includes("cycle") || text.includes("cyclic")) {
      antiPatterns.add("cyclic dependencies");
    }
    if (text.includes("tight coupling") || text.includes("tightly coupled") || text.includes("coupling")) {
      antiPatterns.add("tight coupling");
    }
  }

  return Object.freeze(Array.from(antiPatterns));
}

export function detectArchitecturePattern(report: Readonly<ArchitectureAnalysisReport>): PatternDetectionResult {
  const metrics = derivePatternMetrics(report);
  const currentPattern = inferPatternFromMetrics(metrics);
  const antiPatterns = detectAntiPatterns(report);

  const confidenceBase = 60 + Math.min(30, metrics.moduleCount * 2);
  const confidencePenalty = Math.min(20, antiPatterns.length * 5);

  return Object.freeze({
    currentPattern,
    antiPatterns,
    confidence: Math.max(20, Math.min(95, confidenceBase - confidencePenalty)),
  });
}
