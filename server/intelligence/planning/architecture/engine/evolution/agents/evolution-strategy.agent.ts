import type { ArchitectureAnalysisReport, EvolutionStrategy, PatternDetectionResult } from "../types.js";
import { buildStrategyNarrative, selectTargetPattern } from "../utils/strategy-builder.util.js";

export function buildEvolutionStrategy(
  report: Readonly<ArchitectureAnalysisReport>,
  pattern: Readonly<PatternDetectionResult>,
): EvolutionStrategy {
  const targetPattern = selectTargetPattern(pattern.currentPattern, report);
  const strategy = buildStrategyNarrative(pattern.currentPattern, targetPattern);

  const rationale = Object.freeze([
    `Current architecture detected as ${pattern.currentPattern}.`,
    `Target architecture selected as ${targetPattern}.`,
    `Selection based on scale=${report.metadata?.scale ?? "medium"}, teamSize=${report.metadata?.teamSize ?? 5}, throughputRps=${report.metadata?.throughputRps ?? 150}.`,
  ]);

  return Object.freeze({
    targetPattern,
    strategy,
    rationale,
  });
}
