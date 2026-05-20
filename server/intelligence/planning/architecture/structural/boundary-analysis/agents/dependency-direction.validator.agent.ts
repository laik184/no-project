import type {
  ArchitectureGraph,
  BoundaryViolation,
  DirectionValidationResult,
} from "../types.js";
import { buildNodeIndex, resolveEdgeNodes, detectCycles } from "../utils/graph.util.js";
import { checkDependencyDirection }                       from "../utils/rule.engine.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `bv-dir-${String(_counter).padStart(4, "0")}`;
}
export function resetDirectionValidatorCounter(): void { _counter = 0; }

function buildCycleViolations(
  graph: Readonly<ArchitectureGraph>,
): readonly BoundaryViolation[] {
  const cycles = detectCycles(graph.nodes, graph.edges);
  if (cycles.length === 0) return Object.freeze([]);

  const index = buildNodeIndex(graph.nodes);
  return Object.freeze(
    cycles.map((cycle) => {
      const paths = cycle
        .map((id) => index.byId.get(id)?.path ?? id)
        .join(" → ");
      return Object.freeze<BoundaryViolation>({
        id:       nextId(),
        type:     "CIRCULAR_DEPENDENCY",
        severity: "CRITICAL",
        from:     cycle[0] ?? "",
        to:       cycle[cycle.length - 1] ?? "",
        message:  `Circular dependency detected: ${paths}`,
        rule:     "Circular imports are strictly forbidden. Module graph must be a DAG.",
        layer:    null,
        domain:   null,
      });
    }),
  );
}

export function validateDependencyDirections(
  graph: Readonly<ArchitectureGraph>,
): DirectionValidationResult {
  if (!graph.nodes.length || !graph.edges.length) {
    return Object.freeze({ violations: Object.freeze([]), checkedEdges: 0 });
  }

  const index      = buildNodeIndex(graph.nodes);
  const violations: BoundaryViolation[] = [];
  let   checked    = 0;

  for (const edge of graph.edges) {
    const pair = resolveEdgeNodes(edge, index);
    if (!pair) continue;

    checked += 1;
    const { from, to } = pair;

    if (from.role === to.role) continue;

    const match = checkDependencyDirection(from.role, to.role, from.path, to.path);
    if (!match.violated) continue;

    violations.push(Object.freeze({
      id:       nextId(),
      type:     match.type,
      severity: match.severity,
      from:     from.path,
      to:       to.path,
      message:  match.detail,
      rule:     match.rule,
      layer:    from.layer,
      domain:   from.domain,
    }));
  }

  const cycleViolations = buildCycleViolations(graph);
  const allViolations   = [...violations, ...cycleViolations];

  return Object.freeze({
    violations:   Object.freeze(allViolations),
    checkedEdges: checked,
  });
}

export function illegalDirectionCount(
  result: Readonly<DirectionValidationResult>,
): number {
  return result.violations.filter((v) => v.type === "ILLEGAL_DEPENDENCY_DIRECTION").length;
}

export function circularDependencyCount(
  result: Readonly<DirectionValidationResult>,
): number {
  return result.violations.filter((v) => v.type === "CIRCULAR_DEPENDENCY").length;
}
