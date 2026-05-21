/**
 * server/ast/index.ts
 * Public API for the AST-based code intelligence system.
 */

export { parseFile, parseFiles }               from "./parsers/ast-parser.ts";
export { buildImportGraph, hasCircularDependency, getCircularChains } from "./graph/import-graph-builder.ts";
export { buildSymbolMap, findUnusedExports, findSymbolUsages }        from "./graph/symbol-reference-tracker.ts";
export { detectCircularDependencies, detectFromParsed }               from "./analysis/circular-dependency-detector.ts";
export { detectDeadCode }                                             from "./analysis/dead-code-detector.ts";
export { detectSideEffects }                                          from "./analysis/side-effect-detector.ts";
export { analyzeRefactorImpact }                                      from "./refactors/refactor-impact-analyzer.ts";
export type {
  ASTParseResult, ImportRecord, ExportRecord,
  SymbolReference, ImportGraph, RefactorImpact,
  ASTEditProposal, SideEffectKind,
} from "./types.ts";
