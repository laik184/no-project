/**
 * conflict-graph-builder.ts
 *
 * Builds a directed conflict dependency graph from a ConflictReport.
 * Single responsibility: graph construction + cycle detection + topological ordering.
 *
 * Graph semantics:
 *   Node  = filePath involved in one or more conflicts
 *   Edge  = "filePath A must be resolved before filePath B"
 *
 * Edge construction rule (fixes the prior self-loop bug where from===to):
 *   For any two distinct conflicting files that share a common domain,
 *   add a directed edge from the higher-priority file to the lower-priority file.
 *   (Higher-priority domain's file is resolved first, removing it as a blocker.)
 *
 *   Additionally, structural file-path ordering edges are inferred:
 *     schema files → route files → component files
 *     (ensures DB layer resolves before API layer resolves before UI layer)
 *
 * Consumers use this graph to:
 *   - Detect circular conflict chains (unresolvable without escalation)
 *   - Drive topologically-ordered conflict resolution (leaves resolved first)
 *   - Feed the MergePipeline with a safe processing order
 */

import type { SpecialistDomain } from "../contracts/specialist.contracts.ts";
import { DOMAIN_MERGE_PRIORITY } from "../contracts/specialist.contracts.ts";
import type { ConflictReport, SpecialistConflict }
  from "./specialist-conflict-detector.ts";
import { emitGraphBuilt } from "../telemetry/merge-telemetry.ts";

// ── Graph types ───────────────────────────────────────────────────────────────

export interface ConflictNode {
  filePath:  string;
  domains:   SpecialistDomain[];
  priority:  number;   // min domain priority among claimants
}

export interface ConflictEdge {
  from:   string;   // filePath whose conflict must be resolved first
  to:     string;   // filePath that can only resolve after `from` is settled
  weight: number;   // priority delta (higher = stronger dependency)
  type:   "CONTENT" | "OWNERSHIP" | "ORDERING" | "STRUCTURAL";
}

export interface ConflictGraph {
  runId:    string;
  nodes:    ConflictNode[];
  edges:    ConflictEdge[];
  cycles:   string[][];   // each inner array is a cycle path of filePaths
  topOrder: string[];     // topological order (leaves first), empty if cyclic
}

// ── Structural ordering patterns ─────────────────────────────────────────────

const STRUCTURAL_PRIORITY: Array<[RegExp, number]> = [
  [/schema\.(ts|js)$/,         1],
  [/migration/,                 2],
  [/(drizzle|db)\.config/,     3],
  [/\.(routes|router)\./,      4],
  [/\.(service|storage)\./,    5],
  [/\.(controller|handler)\./,  6],
  [/\.(component|page|view)\./,7],
  [/\.(test|spec)\./,          9],
];

function structuralPriority(filePath: string): number {
  for (const [pattern, priority] of STRUCTURAL_PRIORITY) {
    if (pattern.test(filePath)) return priority;
  }
  return 5; // default mid-priority
}

// ── Builder ───────────────────────────────────────────────────────────────────

export class ConflictGraphBuilder {
  build(runId: string, report: ConflictReport): ConflictGraph {
    const nodes    = this._buildNodes(report.conflicts);
    const edges    = this._buildEdges(report.conflicts, nodes);
    const cycles   = this._detectCycles(nodes, edges);
    const topOrder = cycles.length === 0 ? this._topoSort(nodes, edges) : [];

    const graph: ConflictGraph = { runId, nodes, edges, cycles, topOrder };
    emitGraphBuilt(runId, nodes.length, edges.length, cycles.length);
    return graph;
  }

  private _buildNodes(conflicts: SpecialistConflict[]): ConflictNode[] {
    const nodeMap = new Map<string, ConflictNode>();
    for (const c of conflicts) {
      if (!nodeMap.has(c.filePath)) {
        const priority = Math.min(
          ...c.domains.map(d => DOMAIN_MERGE_PRIORITY[d] ?? 99),
        );
        nodeMap.set(c.filePath, { filePath: c.filePath, domains: [...c.domains], priority });
      } else {
        const node = nodeMap.get(c.filePath)!;
        for (const d of c.domains) {
          if (!node.domains.includes(d)) node.domains.push(d);
        }
        node.priority = Math.min(
          node.priority,
          ...c.domains.map(d => DOMAIN_MERGE_PRIORITY[d] ?? 99),
        );
      }
    }
    return Array.from(nodeMap.values());
  }

  /**
   * Edges connect DISTINCT files (fixes the prior from===to self-loop bug).
   *
   * Rule 1 — Domain cross-file dependency:
   *   If conflicts A and B share a common domain, the one with lower domain-priority
   *   number (higher authority) must resolve first → edge: A → B.
   *
   * Rule 2 — Structural path ordering:
   *   Schema files before route files before component files (path heuristic).
   */
  private _buildEdges(conflicts: SpecialistConflict[], nodes: ConflictNode[]): ConflictEdge[] {
    const edges: ConflictEdge[] = [];
    const seen  = new Set<string>();

    // Rule 1: cross-file domain dependencies
    for (let i = 0; i < conflicts.length; i++) {
      for (let j = i + 1; j < conflicts.length; j++) {
        const ci = conflicts[i];
        const cj = conflicts[j];
        if (ci.filePath === cj.filePath) continue;

        const sharedDomains = ci.domains.filter(d => cj.domains.includes(d));
        if (sharedDomains.length === 0) continue;

        const nodeI = nodes.find(n => n.filePath === ci.filePath)!;
        const nodeJ = nodes.find(n => n.filePath === cj.filePath)!;

        // Lower priority number = higher authority = resolved first = edge source
        const [from, to, weight] = nodeI.priority <= nodeJ.priority
          ? [ci.filePath, cj.filePath, nodeJ.priority - nodeI.priority]
          : [cj.filePath, ci.filePath, nodeI.priority - nodeJ.priority];

        const key = `${from}→${to}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({ from, to, weight, type: ci.type });
        }
      }
    }

    // Rule 2: structural path ordering between all nodes
    const sortedNodes = [...nodes].sort(
      (a, b) => structuralPriority(a.filePath) - structuralPriority(b.filePath),
    );
    for (let i = 0; i < sortedNodes.length - 1; i++) {
      const from = sortedNodes[i].filePath;
      const to   = sortedNodes[i + 1].filePath;
      if (from === to) continue;
      const key = `${from}→${to}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({ from, to, weight: 1, type: "STRUCTURAL" });
      }
    }

    return edges;
  }

  private _detectCycles(nodes: ConflictNode[], edges: ConflictEdge[]): string[][] {
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.filePath, []);
    for (const e of edges) {
      if (e.from !== e.to) adj.get(e.from)?.push(e.to);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const cycles:  string[][] = [];

    const dfs = (path: string[], node: string): void => {
      if (inStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) cycles.push([...path.slice(cycleStart), node]);
        return;
      }
      if (visited.has(node)) return;
      visited.add(node);
      inStack.add(node);
      path.push(node);
      for (const next of adj.get(node) ?? []) dfs(path, next);
      path.pop();
      inStack.delete(node);
    };

    for (const n of nodes) {
      if (!visited.has(n.filePath)) dfs([], n.filePath);
    }
    return cycles;
  }

  private _topoSort(nodes: ConflictNode[], edges: ConflictEdge[]): string[] {
    const inDegree = new Map<string, number>();
    const adj      = new Map<string, string[]>();
    for (const n of nodes) { inDegree.set(n.filePath, 0); adj.set(n.filePath, []); }
    for (const e of edges) {
      if (e.from !== e.to) {
        adj.get(e.from)?.push(e.to);
        inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
      }
    }
    const queue  = nodes.filter(n => (inDegree.get(n.filePath) ?? 0) === 0).map(n => n.filePath);
    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const next of adj.get(node) ?? []) {
        const deg = (inDegree.get(next) ?? 1) - 1;
        inDegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }
    return result;
  }
}

export const conflictGraphBuilder = new ConflictGraphBuilder();
