import type {
  ArchitectureGraph,
  BoundaryViolation,
  DomainLeakageResult,
} from "../types.js";
import { buildNodeIndex, resolveEdgeNodes } from "../utils/graph.util.js";
import { checkDomainLeakage, checkInfrastructureLeakage }
  from "../utils/rule.engine.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `bv-domain-${String(_counter).padStart(4, "0")}`;
}
export function resetDomainLeakageCounter(): void { _counter = 0; }

export function detectDomainLeakage(
  graph: Readonly<ArchitectureGraph>,
): DomainLeakageResult {
  if (!graph.nodes.length || !graph.edges.length) {
    return Object.freeze({ violations: Object.freeze([]), checkedEdges: 0 });
  }

  const index      = buildNodeIndex(graph.nodes);
  const violations: BoundaryViolation[] = [];
  let   checked    = 0;

  for (const edge of graph.edges) {
    const pair = resolveEdgeNodes(edge, index);
    if (!pair) continue;

    const { from, to } = pair;
    if (from.domain === to.domain) continue;

    checked += 1;

    const crossDomain = checkDomainLeakage(
      from.domain, to.domain, from.path, to.path,
    );
    if (crossDomain.violated) {
      violations.push(Object.freeze({
        id:       nextId(),
        type:     crossDomain.type,
        severity: crossDomain.severity,
        from:     from.path,
        to:       to.path,
        message:  crossDomain.detail,
        rule:     crossDomain.rule,
        layer:    from.layer,
        domain:   from.domain,
      }));
      continue;
    }

    const infraLeakage = checkInfrastructureLeakage(
      from.domain, to.domain, from.path, to.path,
    );
    if (infraLeakage.violated) {
      violations.push(Object.freeze({
        id:       nextId(),
        type:     infraLeakage.type,
        severity: infraLeakage.severity,
        from:     from.path,
        to:       to.path,
        message:  infraLeakage.detail,
        rule:     infraLeakage.rule,
        layer:    from.layer,
        domain:   from.domain,
      }));
    }
  }

  return Object.freeze({
    violations:   Object.freeze(violations),
    checkedEdges: checked,
  });
}

export function crossDomainViolations(
  result: Readonly<DomainLeakageResult>,
): readonly BoundaryViolation[] {
  return Object.freeze(result.violations.filter((v) => v.type === "CROSS_DOMAIN_LEAKAGE"));
}

export function infrastructureLeakageViolations(
  result: Readonly<DomainLeakageResult>,
): readonly BoundaryViolation[] {
  return Object.freeze(result.violations.filter((v) => v.type === "INFRASTRUCTURE_LEAKAGE"));
}
