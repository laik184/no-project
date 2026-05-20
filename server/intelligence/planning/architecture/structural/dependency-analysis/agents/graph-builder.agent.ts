import type {
  DependencyInput,
  DependencyGraph,
  GraphNode,
  GraphEdge,
  SourceModule,
} from "../types.js";
import { MAX_MODULES }                   from "../types.js";
import { deduplicateEdges, isValidInput } from "../utils/graph.util.js";

const DEFAULT_LAYER  = 0;
const DEFAULT_DOMAIN = "unknown";

function buildNode(module: Readonly<SourceModule>): GraphNode {
  return Object.freeze({
    id:     module.id,
    path:   module.path,
    layer:  module.layer  ?? DEFAULT_LAYER,
    domain: module.domain ?? DEFAULT_DOMAIN,
  });
}

function buildEdges(
  modules: readonly SourceModule[],
  nodeSet: ReadonlySet<string>,
): readonly GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const m of modules) {
    for (const importId of m.imports) {
      if (importId === m.id)     continue;
      if (!nodeSet.has(importId)) continue;
      edges.push(Object.freeze({
        from: m.id,
        to:   importId,
        kind: "direct" as const,
      }));
    }
  }
  return deduplicateEdges(edges);
}

export function buildDependencyGraph(
  input: Readonly<DependencyInput>,
): DependencyGraph {
  if (!isValidInput(input) || input.modules.length === 0) {
    return Object.freeze({
      projectId: typeof input?.projectId === "string" ? input.projectId : "unknown",
      nodes:     Object.freeze([]),
      edges:     Object.freeze([]),
    });
  }

  const capped  = input.modules.slice(0, MAX_MODULES);
  const nodes   = Object.freeze(capped.map(buildNode));
  const nodeSet = new Set(nodes.map((n) => n.id));
  const edges   = buildEdges(capped, nodeSet);

  return Object.freeze({ projectId: input.projectId, nodes, edges });
}

export function graphNodeCount(graph: Readonly<DependencyGraph>): number {
  return graph.nodes.length;
}

export function graphEdgeCount(graph: Readonly<DependencyGraph>): number {
  return graph.edges.length;
}

export function findRoots(graph: Readonly<DependencyGraph>): readonly GraphNode[] {
  const hasIncoming = new Set(graph.edges.map((e) => e.to));
  return Object.freeze(graph.nodes.filter((n) => !hasIncoming.has(n.id)));
}

export function findLeaves(graph: Readonly<DependencyGraph>): readonly GraphNode[] {
  const hasOutgoing = new Set(graph.edges.map((e) => e.from));
  return Object.freeze(graph.nodes.filter((n) => !hasOutgoing.has(n.id)));
}
