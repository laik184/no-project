import { nodeDegreeMap } from "../utils/graph.util.js";
import { clampScore } from "../utils/scoring.util.js";
import type { FrameworkPatternEngineInput, Violation } from "../types.js";

export interface CouplingAnalysis {
  readonly couplingScore: number;
  readonly violations: readonly Violation[];
}

export function runCouplingAnalyzerAgent(input: FrameworkPatternEngineInput): CouplingAnalysis {
  const degreeMap = nodeDegreeMap(input.codeGraph.edges);
  const violations: Violation[] = [];

  const tightClusters = Object.entries(degreeMap).filter(([, degree]) => degree >= 12);

  for (const [nodeId, degree] of tightClusters) {
    const modulePath = input.codeGraph.nodes.find((node) => node.id === nodeId)?.modulePath ?? nodeId;
    violations.push(
      Object.freeze({
        rule: "tight-coupling-cluster",
        severity: degree > 20 ? "critical" : "high",
        location: modulePath,
        details: `Node degree ${degree} indicates tight coupling cluster.`,
      }),
    );
  }

  const avgDegree = Object.values(degreeMap).length
    ? Object.values(degreeMap).reduce((acc, value) => acc + value, 0) / Object.values(degreeMap).length
    : 0;

  return Object.freeze({
    couplingScore: clampScore(Math.round(100 - avgDegree * 6 - tightClusters.length * 8)),
    violations: Object.freeze(violations),
  });
}
