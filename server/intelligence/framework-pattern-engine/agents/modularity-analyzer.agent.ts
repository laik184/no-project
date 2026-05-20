import { flattenStructure, groupByTopLevel } from "../utils/structure.util.js";
import type { FrameworkPatternEngineInput, Violation } from "../types.js";

export function runModularityAnalyzerAgent(input: FrameworkPatternEngineInput): readonly Violation[] {
  const violations: Violation[] = [];
  const paths = flattenStructure(input.projectStructure);
  const groups = groupByTopLevel(paths);

  for (const [moduleName, count] of Object.entries(groups)) {
    if (count > 40) {
      violations.push(
        Object.freeze({
          rule: "oversized-module",
          severity: "medium",
          location: moduleName,
          details: `Module '${moduleName}' has ${count} items and should be split into focused sub-modules.`,
        }),
      );
    }
  }

  const mixedResponsibilityPaths = paths.filter(
    (path) => path.includes("controller") && path.includes("service"),
  );

  for (const path of mixedResponsibilityPaths) {
    violations.push(
      Object.freeze({
        rule: "mixed-responsibility",
        severity: "medium",
        location: path,
        details: "Single module path suggests mixed controller/service responsibility.",
      }),
    );
  }

  return Object.freeze(violations);
}
