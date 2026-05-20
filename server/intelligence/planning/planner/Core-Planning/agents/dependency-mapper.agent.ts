import type { PlanTask, TaskGraph } from "../types.js";
import { buildGraph }   from "../utils/graph.builder.util.js";
import { hasCycle }     from "../utils/cycle.detector.util.js";

export function mapDependencies(tasks: readonly PlanTask[]): TaskGraph {
  const graph           = buildGraph(tasks);
  const hasCircularDeps = hasCycle(graph.adjacency);

  return Object.freeze<TaskGraph>({
    nodes:           Object.freeze([...tasks]),
    edges:           graph.edges,
    hasCircularDeps,
    adjacency:       graph.adjacency,
  });
}
