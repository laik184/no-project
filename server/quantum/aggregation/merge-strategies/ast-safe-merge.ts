/**
 * ast-safe-merge.ts
 *
 * AST-safe merge strategy for TypeScript/JavaScript source files.
 * Avoids syntactic corruption by working at line-block boundaries rather
 * than raw line diffs. Falls back to confidence winner if structural
 * analysis is inconclusive.
 *
 * NOTE: This is a structural heuristic, NOT a full AST parser.
 * Full AST merging requires a dedicated parser (e.g. ts-morph) — that
 * would be a separate integration. This module provides safe-fallback
 * behaviour for conflicting code files.
 */

import type { AgentResult, MergedFileState } from "../aggregation-types.ts";

export interface AstSafeMergeResult {
  mergedFiles: MergedFileState[];
  fallbacks:   string[];   // files that fell back to confidence winner
}

const CODE_EXTS = /\.(ts|tsx|js|jsx|mts|mjs|cjs)$/;

/**
 * AST-safe merge for TypeScript/JS files.
 * Non-code files are delegated to confidence winner automatically.
 */
export function astSafeMerge(results: AgentResult[]): AstSafeMergeResult {
  const fileMap  = _buildFileMap(results);
  const merged:  MergedFileState[] = [];
  const fallbacks: string[] = [];

  for (const [filePath, candidates] of fileMap) {
    if (candidates.length === 1) {
      const c = candidates[0];
      if (!c.content) continue;
      merged.push({
        filePath, content: c.content, strategy: "ast_safe",
        winnerId: c.nodeId, confidence: c.confidence, mergedAt: Date.now(),
      });
      continue;
    }

    const isCode = CODE_EXTS.test(filePath);
    const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
    const top    = sorted[0];

    if (!isCode || !top.content) {
      if (!top.content) continue;
      fallbacks.push(filePath);
      merged.push({
        filePath, content: top.content, strategy: "ast_safe",
        winnerId: top.nodeId, confidence: top.confidence, mergedAt: Date.now(),
      });
      continue;
    }

    // Structural merge: attempt to splice unique top-level declarations
    const mergeResult = _structuralMerge(top.content, sorted.slice(1).map(c => c.content ?? ""));
    if (!mergeResult.safe) {
      fallbacks.push(filePath);
      merged.push({
        filePath, content: top.content, strategy: "ast_safe",
        winnerId: top.nodeId, confidence: top.confidence, mergedAt: Date.now(),
      });
      continue;
    }

    merged.push({
      filePath, content: mergeResult.content, strategy: "ast_safe",
      winnerId: top.nodeId, confidence: top.confidence, mergedAt: Date.now(),
    });
  }

  return { mergedFiles: merged, fallbacks };
}

// ── Structural merge ──────────────────────────────────────────────────────────

interface StructuralMergeResult { safe: boolean; content: string }

/**
 * Extracts top-level declarations from supplements that are NOT present in
 * the base. Appends them safely at the end. Rejects if the supplement
 * contains conflicting re-declarations of existing identifiers.
 */
function _structuralMerge(base: string, supplements: string[]): StructuralMergeResult {
  const baseDecls  = _extractTopLevelDeclarations(base);
  let   result     = base;
  let   safe       = true;

  for (const supplement of supplements) {
    if (!supplement.trim()) continue;
    const suppDecls = _extractTopLevelDeclarations(supplement);
    const conflicts = [...suppDecls].filter(d => baseDecls.has(d));

    if (conflicts.length > 0) {
      safe = false;
      break;
    }

    const uniqueBlocks = _extractUniqueBlocks(supplement, baseDecls);
    if (uniqueBlocks.length > 0) {
      result += `\n// [ast-safe-merge: ${uniqueBlocks.length} unique declarations added]\n`;
      result += uniqueBlocks.join("\n");
    }
  }

  return { safe, content: result };
}

/**
 * Simple regex-based top-level declaration extractor.
 * Matches: export function/const/class/interface/type/enum declarations.
 */
function _extractTopLevelDeclarations(source: string): Set<string> {
  const pattern = /^(?:export\s+)?(?:async\s+)?(?:function|const|class|interface|type|enum)\s+(\w+)/gm;
  const names   = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    names.add(match[1]);
  }
  return names;
}

/**
 * Extracts blocks (separated by blank lines) that contain only identifiers
 * not already present in the base declarations.
 */
function _extractUniqueBlocks(supplement: string, baseDecls: Set<string>): string[] {
  const blocks = supplement.split(/\n{2,}/);
  return blocks.filter(block => {
    const decls = _extractTopLevelDeclarations(block);
    return decls.size > 0 && [...decls].every(d => !baseDecls.has(d));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface FileCandidate { nodeId: string; content: string | undefined; confidence: number }

function _buildFileMap(results: AgentResult[]): Map<string, FileCandidate[]> {
  const map = new Map<string, FileCandidate[]>();
  for (const result of results) {
    for (const mutation of result.fileMutations) {
      if (!map.has(mutation.filePath)) map.set(mutation.filePath, []);
      map.get(mutation.filePath)!.push({
        nodeId: result.nodeId, content: mutation.content, confidence: result.confidence,
      });
    }
  }
  return map;
}
