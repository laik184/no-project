import type { FrameworkPatternEngineInput, Violation } from "../types.js";

export function runLayeringEnforcerAgent(input: FrameworkPatternEngineInput): readonly Violation[] {
  const violations: Violation[] = [];

  for (const edge of input.codeGraph.edges) {
    const from = input.codeGraph.nodes.find((node) => node.id === edge.from)?.modulePath ?? edge.from;
    const to = input.codeGraph.nodes.find((node) => node.id === edge.to)?.modulePath ?? edge.to;

    if (from.toLowerCase().includes("controller") && to.toLowerCase().includes("db")) {
      violations.push(
        Object.freeze({
          rule: "controller-to-db-direct-access",
          severity: "critical",
          location: `${from} -> ${to}`,
          details: "Controller directly accesses DB layer. Route through service/repository.",
        }),
      );
    }

    const isCrossDomain = from.includes("/domains/") && to.includes("/domains/") && from.split("/domains/")[1]?.split("/")[0] !== to.split("/domains/")[1]?.split("/")[0];

    if (isCrossDomain) {
      violations.push(
        Object.freeze({
          rule: "cross-domain-import",
          severity: "high",
          location: `${from} -> ${to}`,
          details: "Cross-domain import detected between bounded contexts.",
        }),
      );
    }
  }

  return Object.freeze(violations);
}
