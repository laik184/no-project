/**
 * server/ast/refactors/refactor-impact-analyzer.ts
 * Analyzes the impact of a proposed file edit before it is applied.
 * Single responsibility: produce RefactorImpact. Never writes files.
 */

import path from "path";
import type { ASTParseResult, ImportGraph, RefactorImpact } from "../types.ts";

export function analyzeRefactorImpact(
  targetFile:   string,
  symbolsToRemove: string[],
  parsed:       ASTParseResult[],
  graph:        ImportGraph,
): RefactorImpact {
  // Files that import FROM the target
  const affectedFiles = graph.edges
    .filter(e => e.to === targetFile || e.to.startsWith(targetFile.replace(/\.[^.]+$/, "")))
    .map(e => e.from);

  // Broken imports: files that specifically import removed symbols
  const brokenImports: string[] = [];
  for (const result of parsed) {
    if (!affectedFiles.includes(result.filePath)) continue;
    for (const imp of result.imports) {
      const resolvedTo = path.resolve(path.dirname(result.filePath), imp.source);
      if (!resolvedTo.startsWith(targetFile.replace(/\.[^.]+$/, ""))) continue;
      for (const sym of imp.specifiers) {
        if (symbolsToRemove.includes(sym)) {
          brokenImports.push(`${result.filePath} imports "${sym}" from ${targetFile}`);
        }
      }
    }
  }

  const safe   = brokenImports.length === 0;
  const reason = safe
    ? "No consumers import the removed symbols — safe to apply."
    : `${brokenImports.length} file(s) will break: ${brokenImports.slice(0, 2).join("; ")}`;

  return { targetFile, affectedFiles, brokenImports, symbolsRemoved: symbolsToRemove, safe, reason };
}
