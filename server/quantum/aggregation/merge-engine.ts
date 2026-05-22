/**
 * merge-engine.ts
 *
 * Orchestrates merge strategy selection and execution for all file mutations
 * produced by a wave of parallel agent results.
 *
 * Strategy routing:
 *   - Disjoint files (no conflict):     union merge
 *   - Conflicting code files:           ast_safe → precedence fallback
 *   - Conflicting non-code files:       confidence merge
 *   - All files (orchestration winner): precedence merge as authoritative pass
 */

import type { AgentResult, MergedFileState, MergeStrategyKind } from "./aggregation-types.ts";
import { unionMerge }      from "./merge-strategies/union-merge.ts";
import { precedenceMerge } from "./merge-strategies/precedence-merge.ts";
import { confidenceMerge } from "./merge-strategies/confidence-merge.ts";
import { astSafeMerge }    from "./merge-strategies/ast-safe-merge.ts";
import { emitMergeRetry }  from "./aggregation-telemetry.ts";

export interface MergeEngineResult {
  mergedFiles:     MergedFileState[];
  strategiesUsed:  MergeStrategyKind[];
  conflictFiles:   string[];
  resolvedFiles:   string[];
}

const CODE_EXTS = /\.(ts|tsx|js|jsx|mts|mjs|cjs)$/;
const MAX_MERGE_RETRIES = 2;

// ── Public API ─────────────────────────────────────────────────────────────────

export async function runMergeEngine(
  results:  AgentResult[],
  runId:    string,
): Promise<MergeEngineResult> {
  if (results.length === 0) {
    return { mergedFiles: [], strategiesUsed: [], conflictFiles: [], resolvedFiles: [] };
  }

  if (results.length === 1) {
    return _singleResultPassthrough(results[0]);
  }

  const conflictFiles = _findConflictingFiles(results);
  const strategies    = new Set<MergeStrategyKind>();
  let   mergedFiles:  MergedFileState[] = [];
  let   attempt = 0;

  while (attempt <= MAX_MERGE_RETRIES) {
    try {
      mergedFiles = _executeMerge(results, conflictFiles, strategies);
      break;
    } catch (err) {
      attempt++;
      if (attempt > MAX_MERGE_RETRIES) throw err;
      emitMergeRetry(runId, "(all)", attempt);
      await _delay(200 * attempt);
    }
  }

  return {
    mergedFiles,
    strategiesUsed:  Array.from(strategies),
    conflictFiles:   Array.from(conflictFiles),
    resolvedFiles:   mergedFiles.map(f => f.filePath),
  };
}

// ── Internal merge execution ──────────────────────────────────────────────────

function _executeMerge(
  results:       AgentResult[],
  conflictFiles: Set<string>,
  strategies:    Set<MergeStrategyKind>,
): MergedFileState[] {
  const merged = new Map<string, MergedFileState>();

  // Phase 1: union-merge non-conflicting files
  const nonConflictResults = _filterToFiles(results, f => !conflictFiles.has(f));
  if (nonConflictResults.some(r => r.fileMutations.length > 0)) {
    const { mergedFiles } = unionMerge(nonConflictResults);
    strategies.add("union");
    for (const f of mergedFiles) merged.set(f.filePath, f);
  }

  // Phase 2: split conflicting files into code vs non-code
  const codeConflictResults    = _filterToFiles(results, f => conflictFiles.has(f) && CODE_EXTS.test(f));
  const nonCodeConflictResults = _filterToFiles(results, f => conflictFiles.has(f) && !CODE_EXTS.test(f));

  // Phase 2a: AST-safe merge for code files
  if (codeConflictResults.some(r => r.fileMutations.length > 0)) {
    const { mergedFiles, fallbacks } = astSafeMerge(codeConflictResults);
    strategies.add("ast_safe");
    if (fallbacks.length > 0) strategies.add("precedence");
    for (const f of mergedFiles) merged.set(f.filePath, f);
  }

  // Phase 2b: confidence merge for non-code conflicting files
  if (nonCodeConflictResults.some(r => r.fileMutations.length > 0)) {
    const { mergedFiles } = confidenceMerge(nonCodeConflictResults);
    strategies.add("confidence");
    for (const f of mergedFiles) merged.set(f.filePath, f);
  }

  // Phase 3: precedence pass — authoritative override for any remaining gaps
  const { mergedFiles: precedenceFiles } = precedenceMerge(results);
  strategies.add("precedence");
  for (const f of precedenceFiles) {
    if (!merged.has(f.filePath)) merged.set(f.filePath, f);
  }

  return Array.from(merged.values());
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _findConflictingFiles(results: AgentResult[]): Set<string> {
  const count = new Map<string, number>();
  for (const r of results) {
    for (const m of r.fileMutations) {
      count.set(m.filePath, (count.get(m.filePath) ?? 0) + 1);
    }
  }
  return new Set([...count.entries()].filter(([, n]) => n > 1).map(([f]) => f));
}

function _filterToFiles(results: AgentResult[], pred: (f: string) => boolean): AgentResult[] {
  return results.map(r => ({
    ...r,
    fileMutations: r.fileMutations.filter(m => pred(m.filePath)),
  })).filter(r => r.fileMutations.length > 0);
}

function _singleResultPassthrough(result: AgentResult): MergeEngineResult {
  const mergedFiles: MergedFileState[] = result.fileMutations
    .filter(m => m.content)
    .map(m => ({
      filePath: m.filePath, content: m.content!, strategy: "union" as MergeStrategyKind,
      winnerId: result.nodeId, confidence: result.confidence, mergedAt: Date.now(),
    }));
  return { mergedFiles, strategiesUsed: ["union"], conflictFiles: [], resolvedFiles: mergedFiles.map(f => f.filePath) };
}

function _delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
