import type { TaskGraph, ExecutionLevel } from "../types.js";
import { resolveExecutionOrder } from "../utils/order.resolver.util.js";

export function sequenceExecution(graph: TaskGraph): readonly ExecutionLevel[] {
  if (graph.hasCircularDeps) {
    const fallback: ExecutionLevel = Object.freeze({
      level:          0,
      taskIds:        Object.freeze(graph.nodes.map(n => n.id)),
      canParallelize: graph.nodes.length >= 2,
    });
    return Object.freeze([fallback]);
  }

  return resolveExecutionOrder(graph.nodes, graph.adjacency);
}
