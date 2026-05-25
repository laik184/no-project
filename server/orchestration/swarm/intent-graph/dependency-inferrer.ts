/**
 * dependency-inferrer.ts
 *
 * Infers execution-order dependencies between IntentNodes.
 * Single responsibility: edge construction only — no strategy selection, no LLM.
 *
 * Dependency inference rules (precedence order):
 *   1. DOMAIN ORDER — hard precedence: database→backend→security→runtime→frontend→verification
 *   2. STRUCTURAL   — schema must precede routes; routes must precede tests
 *   3. DATA         — any node that reads output of another gets a data edge
 *   4. ORDERING     — explicit temporal language ("then", "after", "first") in goal fragment
 *
 * All edges are deterministic and idempotent — safe to call multiple times.
 */

import type { IntentNode, IntentEdge, SpecialistDomainHint } from "./intent-graph-types.ts";

// ── Domain precedence (lower = must run earlier) ──────────────────────────────

const DOMAIN_PRECEDENCE: Record<SpecialistDomainHint, number> = {
  database:     1,
  backend:      2,
  security:     3,
  runtime:      4,
  frontend:     5,
  verification: 6,
  fullstack:    7,
};

// ── Structural keyword signals ────────────────────────────────────────────────

const SCHEMA_SIGNALS   = ["schema", "migration", "table", "model", "drizzle"];
const ROUTE_SIGNALS    = ["route", "endpoint", "api", "handler", "controller"];
const TEST_SIGNALS     = ["test", "verify", "assertion", "lint", "typecheck"];
const CONSUMER_SIGNALS = ["uses", "depends on", "requires", "after", "following"];

function hasSignal(text: string, signals: string[]): boolean {
  const lower = text.toLowerCase();
  return signals.some(s => lower.includes(s));
}

// ── Edge builders ─────────────────────────────────────────────────────────────

function buildDomainOrderEdges(nodes: IntentNode[]): IntentEdge[] {
  const edges: IntentEdge[] = [];
  const sorted = [...nodes].sort(
    (a, b) => DOMAIN_PRECEDENCE[a.domain] - DOMAIN_PRECEDENCE[b.domain],
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to   = sorted[i + 1];
    if (from.domain !== to.domain) {
      edges.push({
        from:   from.id,
        to:     to.id,
        type:   "ordering",
        weight: 0.9,
      });
    }
  }
  return edges;
}

function buildStructuralEdges(nodes: IntentNode[]): IntentEdge[] {
  const edges: IntentEdge[] = [];

  const schemaNodes = nodes.filter(n => hasSignal(n.goalFragment, SCHEMA_SIGNALS));
  const routeNodes  = nodes.filter(n => hasSignal(n.goalFragment, ROUTE_SIGNALS));
  const testNodes   = nodes.filter(n => hasSignal(n.goalFragment, TEST_SIGNALS));

  // Schema → Route
  for (const schema of schemaNodes) {
    for (const route of routeNodes) {
      if (schema.id !== route.id) {
        edges.push({ from: schema.id, to: route.id, type: "structural", weight: 0.95 });
      }
    }
  }

  // Route → Test
  for (const route of routeNodes) {
    for (const test of testNodes) {
      if (route.id !== test.id) {
        edges.push({ from: route.id, to: test.id, type: "structural", weight: 0.85 });
      }
    }
  }

  // Schema → Test
  for (const schema of schemaNodes) {
    for (const test of testNodes) {
      if (schema.id !== test.id) {
        edges.push({ from: schema.id, to: test.id, type: "structural", weight: 0.80 });
      }
    }
  }

  return edges;
}

function buildDataEdges(nodes: IntentNode[]): IntentEdge[] {
  const edges: IntentEdge[] = [];

  for (const consumer of nodes) {
    if (!hasSignal(consumer.goalFragment, CONSUMER_SIGNALS)) continue;
    for (const producer of nodes) {
      if (producer.id === consumer.id) continue;
      if (DOMAIN_PRECEDENCE[producer.domain] < DOMAIN_PRECEDENCE[consumer.domain]) {
        edges.push({
          from:   producer.id,
          to:     consumer.id,
          type:   "data",
          weight: 0.70,
        });
      }
    }
  }

  return edges;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateEdges(edges: IntentEdge[]): IntentEdge[] {
  const seen = new Set<string>();
  return edges.filter(e => {
    const key = `${e.from}→${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Wave builder — topological sort ───────────────────────────────────────────

export function buildExecutionWaves(nodes: IntentNode[], edges: IntentEdge[]): string[][] {
  const inDegree = new Map<string, number>(nodes.map(n => [n.id, 0]));
  const adj      = new Map<string, string[]>(nodes.map(n => [n.id, []]));

  for (const e of edges) {
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
    adj.get(e.from)?.push(e.to);
  }

  const waves: string[][] = [];
  let frontier = nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0).map(n => n.id);

  while (frontier.length > 0) {
    waves.push([...frontier]);
    const next: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of (adj.get(nodeId) ?? [])) {
        const deg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) next.push(neighbor);
      }
    }
    frontier = next;
  }

  // Any remaining nodes with nonzero in-degree are in cycles — append as final wave
  const remaining = nodes.filter(n => (inDegree.get(n.id) ?? 0) > 0).map(n => n.id);
  if (remaining.length > 0) waves.push(remaining);

  return waves;
}

// ── Public entry point ────────────────────────────────────────────────────────

export function inferDependencies(nodes: IntentNode[]): IntentEdge[] {
  if (nodes.length <= 1) return [];

  const domainEdges     = buildDomainOrderEdges(nodes);
  const structuralEdges = buildStructuralEdges(nodes);
  const dataEdges       = buildDataEdges(nodes);

  return deduplicateEdges([...domainEdges, ...structuralEdges, ...dataEdges]);
}
