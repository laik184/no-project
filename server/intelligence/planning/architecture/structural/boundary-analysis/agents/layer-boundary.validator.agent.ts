import type {
  ArchitectureGraph,
  BoundaryViolation,
  LayerValidationResult,
} from "../types.js";
import { buildNodeIndex, resolveEdgeNodes } from "../utils/graph.util.js";
import { checkLayerDirection }              from "../utils/rule.engine.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `bv-layer-${String(_counter).padStart(4, "0")}`;
}
export function resetLayerValidatorCounter(): void { _counter = 0; }

export function validateLayerBoundaries(
  graph: Readonly<ArchitectureGraph>,
): LayerValidationResult {
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
    if (from.layer === to.layer) continue;

    const match = checkLayerDirection(from.layer, to.layer, from.path, to.path);
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
      domain:   null,
    }));
  }

  return Object.freeze({
    violations: Object.freeze(violations),
    checkedEdges: checked,
  });
}

export function layerViolationCount(result: Readonly<LayerValidationResult>): number {
  return result.violations.length;
}

export function upwardImports(
  result: Readonly<LayerValidationResult>,
): readonly BoundaryViolation[] {
  return Object.freeze(result.violations.filter((v) => v.type === "UPWARD_IMPORT"));
}

export function layerBoundaryViolations(
  result: Readonly<LayerValidationResult>,
): readonly BoundaryViolation[] {
  return Object.freeze(result.violations.filter((v) => v.type === "LAYER_BOUNDARY_VIOLATION"));
}
