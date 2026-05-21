/**
 * server/ast/analysis/dead-code-detector.ts
 * Detects exported symbols that are never imported by other project files.
 * Single responsibility: find unused exports. Read-only.
 */

import { buildSymbolMap, findUnusedExports } from "../graph/symbol-reference-tracker.ts";
import type { ASTParseResult, SymbolReference } from "../types.ts";

export interface DeadCodeFinding {
  symbol:    string;
  definedIn: string;
  hint:      string;
}

export function detectDeadCode(parsed: ASTParseResult[]): DeadCodeFinding[] {
  const symbolMap = buildSymbolMap(parsed);
  const unused    = findUnusedExports(symbolMap);

  return unused.map((ref: SymbolReference) => ({
    symbol:    ref.name,
    definedIn: ref.definedIn,
    hint:      `"${ref.name}" is exported from ${ref.definedIn} but never imported. Consider removing or marking @internal.`,
  }));
}
