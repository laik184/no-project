import type {
  DependencyGraph,
  CouplingScore,
} from "../types.js";
import {
  buildAdjacency,
  buildReverseAdjacency,
  outDegree,
  inDegree,
} from "../utils/graph.util.js";
import {
  computeInstability,
  riskFromInstability,
} from "../utils/score.util.js";

export function analyzeCoupling(
  graph: Readonly<DependencyGraph>,
): readonly CouplingScore[] {
  if (graph.nodes.length === 0) {
    return Object.freeze<CouplingScore[]>([]);
  }

  const adj    = buildAdjacency(graph.edges);
  const revAdj = buildReverseAdjacency(graph.edges);

  const scores: CouplingScore[] = graph.nodes.map((node) => {
    const efferent  = outDegree(adj,    node.id);
    const afferent  = inDegree(revAdj,  node.id);
    const instab    = computeInstability(afferent, efferent);
    const risk      = riskFromInstability(instab);

    return Object.freeze({
      moduleId:         node.id,
      path:             node.path,
      afferentCoupling: afferent,
      efferentCoupling: efferent,
      totalCoupling:    afferent + efferent,
      instability:      instab,
      risk,
    });
  });

  return Object.freeze(scores);
}

export function mostUnstable(
  scores: readonly CouplingScore[],
): CouplingScore | null {
  if (scores.length === 0) return null;
  return scores.reduce(
    (max, s) => (s.instability > max.instability ? s : max),
    scores[0]!,
  );
}

export function mostStable(
  scores: readonly CouplingScore[],
): CouplingScore | null {
  if (scores.length === 0) return null;
  return scores.reduce(
    (min, s) => (s.instability < min.instability ? s : min),
    scores[0]!,
  );
}

export function highestFanOut(
  scores: readonly CouplingScore[],
): CouplingScore | null {
  if (scores.length === 0) return null;
  return scores.reduce(
    (max, s) => (s.efferentCoupling > max.efferentCoupling ? s : max),
    scores[0]!,
  );
}

export function highestFanIn(
  scores: readonly CouplingScore[],
): CouplingScore | null {
  if (scores.length === 0) return null;
  return scores.reduce(
    (max, s) => (s.afferentCoupling > max.afferentCoupling ? s : max),
    scores[0]!,
  );
}

export function criticalModules(
  scores: readonly CouplingScore[],
): readonly CouplingScore[] {
  return Object.freeze(scores.filter((s) => s.risk === "CRITICAL"));
}
