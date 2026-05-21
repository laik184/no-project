/**
 * server/ast/types.ts
 * Shared types for the AST-based code intelligence system.
 * No logic, no imports from sibling modules.
 */

export type SymbolKind = "function" | "class" | "variable" | "type" | "interface" | "enum" | "import" | "export";
export type SideEffectKind = "globalMutation" | "envRead" | "processExit" | "fileWrite" | "networkCall";

export interface ImportRecord {
  source:     string;   // module path
  specifiers: string[]; // named imports
  isDefault:  boolean;
  isDynamic:  boolean;
}

export interface ExportRecord {
  name:      string;
  kind:      SymbolKind;
  isDefault: boolean;
  isReexport: boolean;
}

export interface SymbolReference {
  name:       string;
  kind:       SymbolKind;
  definedIn:  string;   // file path
  usedIn:     string[]; // file paths
  isExported: boolean;
}

export interface ASTParseResult {
  filePath:  string;
  language:  "typescript" | "javascript" | "tsx" | "jsx";
  imports:   ImportRecord[];
  exports:   ExportRecord[];
  symbols:   string[];          // top-level symbol names
  sideEffects: SideEffectKind[];
  parseError?: string;
}

export interface ImportGraph {
  nodes: string[];             // file paths
  edges: Array<{ from: string; to: string; specifiers: string[] }>;
  circular: string[][];        // detected circular dependency chains
}

export interface RefactorImpact {
  targetFile:     string;
  affectedFiles:  string[];
  brokenImports:  string[];
  symbolsRemoved: string[];
  safe:           boolean;
  reason:         string;
}

export interface ASTEditProposal {
  filePath:   string;
  operation:  "insert" | "delete" | "replace";
  targetNode: string;  // node type/name to target
  newCode:    string;
  safeToApply: boolean;
}
