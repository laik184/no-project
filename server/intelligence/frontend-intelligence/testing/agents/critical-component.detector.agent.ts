import type {
  ComponentDescriptor,
  ComponentTestMapping,
  CriticalComponentResult,
  IssueSeverity,
} from "../types.js";
import {
  computeCriticalityScore,
  buildCriticalityReasons,
  isCritical,
} from "../utils/component-resolver.util.js";

const CRITICAL_UNTESTED_HIGH_THRESHOLD = 70;
const CRITICAL_UNTESTED_MEDIUM_THRESHOLD = 40;

function deriveSeverity(
  criticalityScore: number,
  isTested: boolean
): IssueSeverity {
  if (isTested) return "LOW";
  if (criticalityScore >= CRITICAL_UNTESTED_HIGH_THRESHOLD) return "CRITICAL";
  if (criticalityScore >= CRITICAL_UNTESTED_MEDIUM_THRESHOLD) return "HIGH";
  return "MEDIUM";
}

export function detectCriticalComponents(
  components: readonly ComponentDescriptor[],
  mappings: readonly ComponentTestMapping[]
): readonly CriticalComponentResult[] {
  const testedIds = new Set<string>(
    mappings.filter((m) => m.isTested).map((m) => m.componentId)
  );

  const results: CriticalComponentResult[] = [];

  for (const component of components) {
    if (!isCritical(component)) continue;

    const criticalityScore = computeCriticalityScore(component);
    const isTestedFlag = testedIds.has(component.id);
    const reasons = buildCriticalityReasons(component);
    const severity = deriveSeverity(criticalityScore, isTestedFlag);

    results.push(
      Object.freeze({
        componentId: component.id,
        componentName: component.name,
        filePath: component.filePath,
        criticalityScore,
        reasons,
        isTested: isTestedFlag,
        severity,
      })
    );
  }

  results.sort((a, b) => {
    if (!a.isTested && b.isTested) return -1;
    if (a.isTested && !b.isTested) return 1;
    return b.criticalityScore - a.criticalityScore;
  });

  return Object.freeze(results);
}
