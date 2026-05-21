/**
 * server/ast/analysis/dependency-analyzer.ts
 * Analyzes inter-file dependency relationships from AST parse results.
 * Single responsibility: dependency map construction. No filesystem mutations.
 */

import type { ASTParseResult, ImportGraph } from "../types.ts";

export interface DependencyMap {
  /** file → files it imports */
  outgoing: Map<string, Set<string>>;
  /** file → files that import it */
  incoming: Map<string, Set<string>>;
}

export interface DependencyAnalysis {
  graph:          ImportGraph;
  dependencyMap:  DependencyMap;
  externalDeps:   string[];   // npm packages (non-relative)
  internalDeps:   string[];   // relative imports
  orphanFiles:    string[];   // files with no importers
  leafFiles:      string[];   // files that import nothing
}

function isExternal(source: string): boolean {
  return !source.startsWith(".") && !source.startsWith("/");
}

function resolveRelative(from: string, to: string): string {
  if (isExternal(to)) return to;
  const fromDir = from.replace(/\/[^/]+$/, "");
  return `${fromDir}/${to}`.replace(/\/\.\//g, "/").replace(/[^/]+\/\.\.\//g, "");
}

export function buildDependencyMap(results: ASTParseResult[]): DependencyMap {
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();

  for (const r of results) {
    if (!outgoing.has(r.filePath)) outgoing.set(r.filePath, new Set());
    if (!incoming.has(r.filePath)) incoming.set(r.filePath, new Set());

    for (const imp of r.imports) {
      if (isExternal(imp.source)) continue;
      const resolved = resolveRelative(r.filePath, imp.source);
      outgoing.get(r.filePath)!.add(resolved);
      if (!incoming.has(resolved)) incoming.set(resolved, new Set());
      incoming.get(resolved)!.add(r.filePath);
    }
  }

  return { outgoing, incoming };
}

export function analyzeDependencies(results: ASTParseResult[]): DependencyAnalysis {
  const map        = buildDependencyMap(results);
  const allFiles   = results.map(r => r.filePath);
  const nodes      = allFiles;
  const edges: ImportGraph["edges"] = [];
  const circular: string[][] = [];

  for (const r of results) {
    for (const imp of r.imports) {
      if (isExternal(imp.source)) continue;
      const resolved = resolveRelative(r.filePath, imp.source);
      edges.push({ from: r.filePath, to: resolved, specifiers: imp.specifiers });
    }
  }

  const externalDeps = Array.from(
    new Set(results.flatMap(r => r.imports.filter(i => isExternal(i.source)).map(i => i.source)))
  );

  const internalDeps = Array.from(
    new Set(results.flatMap(r => r.imports.filter(i => !isExternal(i.source)).map(i => i.source)))
  );

  const orphanFiles = allFiles.filter(f => (map.incoming.get(f)?.size ?? 0) === 0);
  const leafFiles   = allFiles.filter(f => (map.outgoing.get(f)?.size ?? 0) === 0);

  return {
    graph:         { nodes, edges, circular },
    dependencyMap: map,
    externalDeps,
    internalDeps,
    orphanFiles,
    leafFiles,
  };
}
