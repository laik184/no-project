import type {
  DependencyGraph,
  DependencyCluster,
} from "../types.js";
import {
  buildAdjacency,
  buildReverseAdjacency,
} from "../utils/graph.util.js";
import { weaklyConnectedComponents } from "../utils/traversal.util.js";
import { clusterCohesion }           from "../utils/score.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `clust-${String(_counter).padStart(4, "0")}`;
}
export function resetClusterDetectorCounter(): void { _counter = 0; }

function countInternalEdges(
  memberSet: ReadonlySet<string>,
  edges:     readonly { from: string; to: string }[],
): number {
  return edges.filter(
    (e) => memberSet.has(e.from) && memberSet.has(e.to),
  ).length;
}

function countExternalEdges(
  memberSet: ReadonlySet<string>,
  edges:     readonly { from: string; to: string }[],
): number {
  return edges.filter(
    (e) =>
      (memberSet.has(e.from) && !memberSet.has(e.to)) ||
      (!memberSet.has(e.from) && memberSet.has(e.to)),
  ).length;
}

function buildCluster(
  members:   readonly string[],
  pathMap:   ReadonlyMap<string, string>,
  edges:     readonly { from: string; to: string }[],
): DependencyCluster {
  const memberSet    = new Set(members);
  const internal     = countInternalEdges(memberSet, edges);
  const external     = countExternalEdges(memberSet, edges);
  const cohesionVal  = clusterCohesion(internal, external);
  const memberPaths  = members.map((id) => pathMap.get(id) ?? id);

  return Object.freeze({
    id:            nextId(),
    members:       Object.freeze([...members]),
    memberPaths:   Object.freeze(memberPaths),
    internalEdges: internal,
    externalEdges: external,
    cohesion:      cohesionVal,
  });
}

export function detectClusters(
  graph: Readonly<DependencyGraph>,
): readonly DependencyCluster[] {
  if (graph.nodes.length === 0) {
    return Object.freeze<DependencyCluster[]>([]);
  }

  const adj     = buildAdjacency(graph.edges);
  const revAdj  = buildReverseAdjacency(graph.edges);
  const nodeIds = graph.nodes.map((n) => n.id);

  const pathMap = new Map(graph.nodes.map((n) => [n.id, n.path]));
  const components = weaklyConnectedComponents(nodeIds, adj, revAdj);

  const clusters: DependencyCluster[] = components
    .filter((c) => c.length > 0)
    .map((members) => buildCluster(members, pathMap, graph.edges));

  return Object.freeze(clusters);
}

export function largestCluster(
  clusters: readonly DependencyCluster[],
): DependencyCluster | null {
  if (clusters.length === 0) return null;
  return clusters.reduce(
    (max, c) => (c.members.length > max.members.length ? c : max),
    clusters[0]!,
  );
}

export function isolatedModules(
  clusters: readonly DependencyCluster[],
): readonly DependencyCluster[] {
  return Object.freeze(
    clusters.filter((c) => c.members.length === 1 && c.externalEdges === 0),
  );
}

export function avgClusterCohesion(clusters: readonly DependencyCluster[]): number {
  if (clusters.length === 0) return 0;
  const total = clusters.reduce((s, c) => s + c.cohesion, 0);
  return Math.round((total / clusters.length) * 1000) / 1000;
}
