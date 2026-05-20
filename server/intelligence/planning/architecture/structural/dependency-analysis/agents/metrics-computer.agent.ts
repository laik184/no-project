import type {
  DependencyGraph,
  CouplingScore,
  CycleGroup,
  DependencyCluster,
  DependencyMetrics,
} from "../types.js";
import { LARGE_CYCLE_THRESHOLD }   from "../types.js";
import {
  buildAdjacency,
  buildReverseAdjacency,
  outDegree,
  inDegree,
  graphDensity,
} from "../utils/graph.util.js";
import {
  computeHealthScore,
  avgInstabilityScore,
} from "../utils/score.util.js";
import { longestPath } from "../utils/traversal.util.js";

function computeAvg(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((s, v) => s + v, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function computeMax(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

export function computeMetrics(
  graph:    Readonly<DependencyGraph>,
  cycles:   readonly CycleGroup[],
  coupling: readonly CouplingScore[],
  clusters: readonly DependencyCluster[],
): DependencyMetrics {
  if (graph.nodes.length === 0) {
    return Object.freeze({
      totalModules:       0,
      totalEdges:         0,
      avgFanOut:          0,
      avgFanIn:           0,
      maxFanOut:          0,
      maxFanIn:           0,
      graphDensity:       0,
      cycleCount:         0,
      modulesInCycles:    0,
      clusterCount:       0,
      avgInstability:     0,
      maxDepth:           0,
      overallHealthScore: 100,
    });
  }

  const adj    = buildAdjacency(graph.edges);
  const revAdj = buildReverseAdjacency(graph.edges);
  const ids    = graph.nodes.map((n) => n.id);

  const fanOuts = ids.map((id) => outDegree(adj,    id));
  const fanIns  = ids.map((id) => inDegree(revAdj,  id));

  const density      = graphDensity(graph.nodes.length, graph.edges.length);
  const depth        = longestPath(ids, adj);
  const cycleMembers = new Set(cycles.flatMap((c) => [...c.members]));
  const largeCycles  = cycles.filter((c) => c.length >= LARGE_CYCLE_THRESHOLD);

  const highRisk     = coupling.filter((s) => s.risk === "HIGH").length;
  const critRisk     = coupling.filter((s) => s.risk === "CRITICAL").length;
  const instabilities = coupling.map((s) => s.instability);

  const health = computeHealthScore({
    cycleCount:        cycles.length,
    largeCycleCount:   largeCycles.length,
    highRiskCount:     highRisk,
    criticalRiskCount: critRisk,
    density,
  });

  return Object.freeze({
    totalModules:       graph.nodes.length,
    totalEdges:         graph.edges.length,
    avgFanOut:          computeAvg(fanOuts),
    avgFanIn:           computeAvg(fanIns),
    maxFanOut:          computeMax(fanOuts),
    maxFanIn:           computeMax(fanIns),
    graphDensity:       density,
    cycleCount:         cycles.length,
    modulesInCycles:    cycleMembers.size,
    clusterCount:       clusters.length,
    avgInstability:     avgInstabilityScore(instabilities),
    maxDepth:           depth < 0 ? -1 : depth,
    overallHealthScore: health,
  });
}

export function healthGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export function metricsSnapshot(metrics: Readonly<DependencyMetrics>): string {
  return [
    `modules=${metrics.totalModules}`,
    `edges=${metrics.totalEdges}`,
    `cycles=${metrics.cycleCount}`,
    `health=${metrics.overallHealthScore}`,
    `density=${metrics.graphDensity}`,
  ].join(" | ");
}
