/**
 * server/ast/graph/symbol-reference-tracker.ts
 * Tracks where symbols are defined and where they are used across files.
 * Single responsibility: symbol reference map. No filesystem I/O.
 */

import type { ASTParseResult, SymbolReference } from "../types.ts";

// ── Public API ────────────────────────────────────────────────────────────────

export function buildSymbolMap(parseResults: ASTParseResult[]): Map<string, SymbolReference> {
  const map = new Map<string, SymbolReference>();

  // 1. Register all exported symbols
  for (const result of parseResults) {
    for (const exp of result.exports) {
      const key = `${result.filePath}::${exp.name}`;
      map.set(key, {
        name:       exp.name,
        kind:       exp.kind,
        definedIn:  result.filePath,
        usedIn:     [],
        isExported: true,
      });
    }
  }

  // 2. Track usages via imports
  for (const result of parseResults) {
    for (const imp of result.imports) {
      for (const specifier of imp.specifiers) {
        // Find matching export from any file
        for (const [key, ref] of map) {
          if (ref.name === specifier && !ref.usedIn.includes(result.filePath)) {
            ref.usedIn.push(result.filePath);
          }
        }
      }
    }
  }

  return map;
}

export function findUnusedExports(symbolMap: Map<string, SymbolReference>): SymbolReference[] {
  return [...symbolMap.values()].filter(
    ref => ref.isExported && ref.usedIn.length === 0 && ref.name !== "default",
  );
}

export function findSymbolUsages(
  symbolMap: Map<string, SymbolReference>,
  symbolName: string,
): SymbolReference[] {
  return [...symbolMap.values()].filter(ref => ref.name === symbolName);
}
