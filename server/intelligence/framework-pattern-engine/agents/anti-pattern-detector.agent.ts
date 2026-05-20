import { detectCycles, nodeDegreeMap } from "../utils/graph.util.js";
import { flattenStructure, maxPathDepth } from "../utils/structure.util.js";
import type { AntiPattern, FrameworkPatternEngineInput } from "../types.js";

export function runAntiPatternDetectorAgent(input: FrameworkPatternEngineInput): readonly AntiPattern[] {
  const results: AntiPattern[] = [];

  const degreeMap = nodeDegreeMap(input.codeGraph.edges);
  const highDegreeNodes = Object.entries(degreeMap).filter(([, degree]) => degree >= 10);

  if (highDegreeNodes.length > 0) {
    results.push(
      Object.freeze({
        name: "god class",
        severity: "high",
        evidence: Object.freeze(highDegreeNodes.slice(0, 3).map(([name]) => `High-degree node: ${name}`)),
      }),
    );
  }

  const fatControllers = input.codeGraph.nodes
    .filter((node) => node.modulePath.toLowerCase().includes("controller"))
    .filter((node) => (degreeMap[node.id] ?? 0) >= 8);

  if (fatControllers.length > 0) {
    results.push(
      Object.freeze({
        name: "fat controller",
        severity: "high",
        evidence: Object.freeze(fatControllers.map((node) => `Controller has high dependency fan-in/out: ${node.modulePath}`)),
      }),
    );
  }

  if (Object.values(degreeMap).some((degree) => degree >= 14)) {
    results.push(
      Object.freeze({
        name: "tight coupling",
        severity: "critical",
        evidence: Object.freeze(["Detected very high graph coupling degree cluster"]),
      }),
    );
  }

  const cycles = detectCycles(input.codeGraph.edges);
  if (cycles.length > 0) {
    results.push(
      Object.freeze({
        name: "circular dependencies",
        severity: "critical",
        evidence: Object.freeze(cycles.slice(0, 3).map((cycle) => `Cycle: ${cycle.join(" -> ")}`)),
      }),
    );
  }

  const fileDepth = maxPathDepth(flattenStructure(input.projectStructure));
  if (fileDepth >= 7) {
    results.push(
      Object.freeze({
        name: "deep nesting",
        severity: "medium",
        evidence: Object.freeze([`Maximum folder depth is ${fileDepth}`]),
      }),
    );
  }

  return Object.freeze(results);
}
