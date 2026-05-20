const MAX_ITERATIONS = 10_000;

type AdjacencyMap = Readonly<Record<string, readonly string[]>>;

type VisitState = "unvisited" | "in-progress" | "done";

function dfsDetect(
  nodeId:   string,
  adj:      AdjacencyMap,
  visited:  Map<string, VisitState>,
  counter:  { count: number },
): boolean {
  if (counter.count >= MAX_ITERATIONS) return false;
  counter.count += 1;

  const state = visited.get(nodeId) ?? "unvisited";

  if (state === "in-progress") return true;
  if (state === "done")        return false;

  visited.set(nodeId, "in-progress");

  const neighbors = adj[nodeId] ?? [];
  for (const neighbor of neighbors) {
    if (dfsDetect(neighbor, adj, visited, counter)) return true;
  }

  visited.set(nodeId, "done");
  return false;
}

export function hasCycle(adj: AdjacencyMap): boolean {
  const visited: Map<string, VisitState> = new Map();
  const counter  = { count: 0 };

  for (const nodeId of Object.keys(adj)) {
    const state = visited.get(nodeId) ?? "unvisited";
    if (state === "unvisited") {
      if (dfsDetect(nodeId, adj, visited, counter)) return true;
    }
  }

  return false;
}

export function findCycleNodes(adj: AdjacencyMap): readonly string[] {
  const cycleNodes: string[] = [];
  const visited: Map<string, VisitState> = new Map();
  const counter = { count: 0 };
  const path: string[] = [];

  function dfsTrace(nodeId: string): boolean {
    if (counter.count >= MAX_ITERATIONS) return false;
    counter.count += 1;

    const state = visited.get(nodeId) ?? "unvisited";
    if (state === "in-progress") {
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        cycleNodes.push(...path.slice(cycleStart));
      }
      return true;
    }
    if (state === "done") return false;

    visited.set(nodeId, "in-progress");
    path.push(nodeId);

    const neighbors = adj[nodeId] ?? [];
    for (const neighbor of neighbors) {
      if (dfsTrace(neighbor)) {
        path.pop();
        visited.set(nodeId, "done");
        return true;
      }
    }

    path.pop();
    visited.set(nodeId, "done");
    return false;
  }

  for (const nodeId of Object.keys(adj)) {
    const state = visited.get(nodeId) ?? "unvisited";
    if (state === "unvisited") {
      dfsTrace(nodeId);
      if (cycleNodes.length > 0) break;
    }
  }

  return Object.freeze([...new Set(cycleNodes)]);
}
