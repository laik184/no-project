import type {
  DependencyGraph,
  CycleGroup,
} from "../types.js";
import { MAX_CYCLES_REPORTED }                   from "../types.js";
import { buildAdjacency, nodeById, allNodeIds }  from "../utils/graph.util.js";
import { riskFromCycleSize }                     from "../utils/score.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `cyc-${String(_counter).padStart(4, "0")}`;
}
export function resetCycleDetectorCounter(): void { _counter = 0; }

function tarjanSCC(
  nodeIds: readonly string[],
  adj:     ReadonlyMap<string, readonly string[]>,
): readonly (readonly string[])[] {
  const index   = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack:   string[] = [];
  const sccs:    string[][] = [];
  let   counter  = 0;

  function strongConnect(v: string): void {
    index.set(v, counter);
    lowlink.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, index.get(w)!));
      }
    }

    if (lowlink.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  for (const id of nodeIds) {
    if (!index.has(id)) strongConnect(id);
  }

  return Object.freeze(sccs.map((s) => Object.freeze(s)));
}

export function detectCycles(
  graph: Readonly<DependencyGraph>,
): readonly CycleGroup[] {
  if (graph.nodes.length === 0) {
    return Object.freeze<CycleGroup[]>([]);
  }

  const adj     = buildAdjacency(graph.edges);
  const nodeIds = allNodeIds(graph);
  const sccs    = tarjanSCC(nodeIds, adj);

  const cycles: CycleGroup[] = [];
  for (const scc of sccs) {
    if (scc.length < 2) continue;
    if (cycles.length >= MAX_CYCLES_REPORTED) break;

    const memberPaths = scc
      .map((id) => nodeById(graph, id)?.path ?? id);

    cycles.push(Object.freeze({
      id:          nextId(),
      members:     Object.freeze([...scc]),
      memberPaths: Object.freeze(memberPaths),
      length:      scc.length,
      severity:    riskFromCycleSize(scc.length),
    }));
  }

  return Object.freeze(cycles);
}

export function cycleCount(cycles: readonly CycleGroup[]): number {
  return cycles.length;
}

export function modulesInCycles(cycles: readonly CycleGroup[]): number {
  const unique = new Set(cycles.flatMap((c) => [...c.members]));
  return unique.size;
}

export function largeCycles(
  cycles: readonly CycleGroup[],
): readonly CycleGroup[] {
  return Object.freeze(
    cycles.filter((c) => c.length >= MAX_CYCLES_REPORTED / 10),
  );
}
