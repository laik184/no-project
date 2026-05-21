/**
 * server/ast/graph/import-graph-builder.ts
 * Builds a directed import graph from a set of ASTParseResults.
 * Detects circular dependency chains via DFS.
 * Single responsibility: graph construction. No filesystem I/O.
 */

import path from "path";
import type { ASTParseResult, ImportGraph } from "../types.ts";

// ── Resolve relative import to absolute ───────────────────────────────────────

function resolveImport(fromFile: string, importSource: string): string | null {
  if (!importSource.startsWith(".")) return null; // external package
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, importSource);
  // Try common extensions
  for (const ext of [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"]) {
    if (resolved.endsWith(ext)) return resolved;
  }
  return resolved + ".ts";
}

// ── Circular dependency detection (DFS) ──────────────────────────────────────

function findCircular(
  adj:     Map<string, string[]>,
  node:    string,
  visited: Set<string>,
  stack:   string[],
  results: string[][],
): void {
  visited.add(node);
  stack.push(node);

  for (const neighbor of adj.get(node) ?? []) {
    if (!visited.has(neighbor)) {
      findCircular(adj, neighbor, visited, stack, results);
    } else {
      const cycleStart = stack.indexOf(neighbor);
      if (cycleStart !== -1) {
        results.push(stack.slice(cycleStart));
      }
    }
  }

  stack.pop();
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildImportGraph(parseResults: ASTParseResult[]): ImportGraph {
  const nodes = parseResults.map(r => r.filePath);
  const edges: ImportGraph["edges"] = [];
  const adj   = new Map<string, string[]>();

  for (const result of parseResults) {
    const adjacents: string[] = [];

    for (const imp of result.imports) {
      if (imp.isDynamic) continue;
      const resolved = resolveImport(result.filePath, imp.source);
      if (!resolved) continue;

      edges.push({
        from:       result.filePath,
        to:         resolved,
        specifiers: imp.specifiers,
      });
      adjacents.push(resolved);
    }

    adj.set(result.filePath, adjacents);
  }

  // Circular detection
  const visited = new Set<string>();
  const circular: string[][] = [];

  for (const node of nodes) {
    if (!visited.has(node)) {
      findCircular(adj, node, visited, [], circular);
    }
  }

  return { nodes, edges, circular };
}

export function hasCircularDependency(graph: ImportGraph): boolean {
  return graph.circular.length > 0;
}

export function getCircularChains(graph: ImportGraph): string[] {
  return graph.circular.map(chain => chain.join(" → "));
}
