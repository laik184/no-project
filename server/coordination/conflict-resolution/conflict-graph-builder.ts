/**
 * conflict-graph-builder.ts
 *
 * Builds a directed conflict dependency graph from a ConflictReport.
 * Single responsibility: graph construction + cycle detection.
 *
 * Graph semantics:
 *   Node  = file path
 *   Edge  = "domain A conflicts with domain B over this file" (directed: lower priority → higher)
 *
 * Consumers use this graph to:
 *   - Detect circular conflict chains (impossible to resolve without escalation)
 *   - Topologically order conflict resolution (resolve leaves first)
 *   - Provide visual conflict dependency trees to observers
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
  from:   string;   // filePath of lower-priority domain's patch
  to:     string;   // filePath that blocks resolution
  weight: number;   // priority delta (higher = stronger dependency)
  type:   "CONTENT" | "OWNERSHIP" | "ORDERING";
}

export interface ConflictGraph {
  runId:     string;
  nodes:     ConflictNode[];
  edges:     ConflictEdge[];
  cycles:    string[][];   // each inner array is a cycle path of filePaths
  topOrder:  string[];     // topological order (leaves first), empty if cyclic
}

// ── Builder ───────────────────────────────────────────────────────────────────

export class ConflictGraphBuilder {
  build(runId: string, report: ConflictReport): ConflictGraph {
    const nodes = this._buildNodes(report.conflicts);
    const edges = this._buildEdges(report.conflicts, nodes);
    const cycles = this._detectCycles(nodes, edges);
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
        node.priority = Math.min(node.priority, DOMAIN_MERGE_PRIORITY[c.domains[0]] ?? 99);
      }
    }
    return Array.from(nodeMap.values());
  }

  private _buildEdges(conflicts: SpecialistConflict[], nodes: ConflictNode[]): ConflictEdge[] {
    const edges: ConflictEdge[] = [];
    const nodeIdx = new Map(nodes.map(n => [n.filePath, n]));

    for (const c of conflicts) {
      if (c.domains.length < 2) continue;
      const sorted = [...c.domains].sort(
        (a, b) => (DOMAIN_MERGE_PRIORITY[a] ?? 99) - (DOMAIN_MERGE_PRIORITY[b] ?? 99),
      );
      // Edge: lower-priority domain's file → higher-priority domain's file
      for (let i = 0; i < sorted.length - 1; i++) {
        const fromPri = DOMAIN_MERGE_PRIORITY[sorted[i]]   ?? 99;
        const toPri   = DOMAIN_MERGE_PRIORITY[sorted[i + 1]] ?? 99;
        edges.push({
          from:   c.filePath,
          to:     c.filePath,
          weight: toPri - fromPri,
          type:   c.type,
        });
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
    const cycles: string[][] = [];

    const dfs = (path: string[], node: string): void => {
      if (inStack.has(node)) {
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
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
