/**
 * server/agents/executor/memory/failure-memory.ts
 *
 * Failure pattern intelligence across runs.
 * Detects repeated failures, recurring TS/validation errors, browser
 * instability, and retry storms by maintaining a pattern frequency table.
 *
 * No execution logic. No tool imports.
 */

import type { TaskKind } from '../types/executor.types.ts';
import { memoryEngine } from '../../../memory/core/memory-engine.ts';

// ── Pattern signature ─────────────────────────────────────────────────────────

export interface FailurePattern {
  signature:     string;   // normalized error key
  toolName:      string;
  kind:          TaskKind;
  errorSnippet:  string;
  occurrences:   number;
  firstSeen:     number;
  lastSeen:      number;
  runIds:        string[];
}

export type FailureCategory =
  | 'retry-storm'
  | 'infinite-loop'
  | 'browser-instability'
  | 'ts-error'
  | 'validation-failure'
  | 'dead-execution'
  | 'unknown';

export interface FailureAnalysis {
  category:       FailureCategory;
  pattern:        FailurePattern;
  isChronicle:    boolean;   // seen 3+ times
  recommendation: string;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _patterns = new Map<string, FailurePattern>();
const CHRONIC_THRESHOLD = 3;
const STORM_WINDOW_MS   = 30_000; // 30s
const _recentTimestamps: number[] = [];

function _normalise(error: string): string {
  return error
    .toLowerCase()
    .replace(/\b(run|step|task|file|line|col)\w*[\s:=]+[\w./:-]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function _makeSignature(toolName: string, kind: TaskKind, error: string): string {
  return `${kind}::${toolName}::${_normalise(error)}`;
}

function _categorise(error: string, kind: TaskKind): FailureCategory {
  if (/browser|playwright|page|navigation/i.test(error)) return 'browser-instability';
  if (/ts\d{4}|type.*error|cannot find|property.*does not exist/i.test(error)) return 'ts-error';
  if (/validation|invalid.*input|schema/i.test(error)) return 'validation-failure';
  if (/infinite|loop|recursion/i.test(error))          return 'infinite-loop';
  if (/dead|unresponsive|timeout/i.test(error))        return 'dead-execution';
  return 'unknown';
}

// ── API ───────────────────────────────────────────────────────────────────────

export const failureMemory = {
  recordFailurePattern(
    runId:    string,
    toolName: string,
    kind:     TaskKind,
    error:    string,
  ): FailurePattern {
    const sig = _makeSignature(toolName, kind, error);
    const existing = _patterns.get(sig);
    const now = Date.now();
    _recentTimestamps.push(now);

    if (existing) {
      existing.occurrences++;
      existing.lastSeen = now;
      if (!existing.runIds.includes(runId)) existing.runIds.push(runId);

      // Write-through: persist updated pattern to long-term memory (fire-and-forget)
      memoryEngine.store({
        category: 'bug',
        content:  JSON.stringify(existing),
        tags:     [toolName, kind, _categorise(error, kind)],
        score:    existing.occurrences >= CHRONIC_THRESHOLD ? 0.1 : 0.4,
        meta:     { runId, agentSource: 'executor-failure-memory', signature: sig },
      }).catch(console.error);

      return existing;
    }

    const pattern: FailurePattern = {
      signature:    sig,
      toolName,
      kind,
      errorSnippet: error.slice(0, 200),
      occurrences:  1,
      firstSeen:    now,
      lastSeen:     now,
      runIds:       [runId],
    };
    _patterns.set(sig, pattern);

    // Write-through: persist new pattern to long-term memory (fire-and-forget)
    memoryEngine.store({
      category: 'bug',
      content:  JSON.stringify(pattern),
      tags:     [toolName, kind, _categorise(error, kind)],
      score:    0.5,
      meta:     { runId, agentSource: 'executor-failure-memory', signature: sig },
    }).catch(console.error);

    return pattern;
  },

  hasSeenFailure(toolName: string, kind: TaskKind, error: string): boolean {
    return _patterns.has(_makeSignature(toolName, kind, error));
  },

  getFailureFrequency(toolName: string, kind: TaskKind, error: string): number {
    return _patterns.get(_makeSignature(toolName, kind, error))?.occurrences ?? 0;
  },

  analyze(
    runId:    string,
    toolName: string,
    kind:     TaskKind,
    error:    string,
  ): FailureAnalysis {
    const pattern    = this.recordFailurePattern(runId, toolName, kind, error);
    const isChronicle = pattern.occurrences >= CHRONIC_THRESHOLD;
    const category   = _categorise(error, kind);

    let recommendation = 'retry with backoff';
    if (category === 'browser-instability') recommendation = 'restart browser session';
    else if (category === 'ts-error')        recommendation = 'apply type-safe patch';
    else if (category === 'validation-failure') recommendation = 'repair input schema';
    else if (category === 'dead-execution')  recommendation = 'timeout recovery + checkpoint restore';
    else if (isChronicle)                    recommendation = 'escalate to human review';

    return { category, pattern, isChronicle, recommendation };
  },

  /** Detect if recent failure rate constitutes a retry storm. */
  isRetryStorm(): boolean {
    const cutoff = Date.now() - STORM_WINDOW_MS;
    const recent = _recentTimestamps.filter((t) => t >= cutoff).length;
    return recent >= 10;
  },

  chroniclePatterns(): FailurePattern[] {
    return [..._patterns.values()].filter((p) => p.occurrences >= CHRONIC_THRESHOLD);
  },

  allPatterns(): FailurePattern[] {
    return [..._patterns.values()];
  },

  /**
   * Hydrate the in-process pattern map from persisted patterns loaded at startup.
   * Idempotent: skips if the store already has patterns.
   * Returns the number of patterns restored.
   */
  hydrate(patterns: FailurePattern[]): number {
    if (_patterns.size > 0) return 0;      // already populated — skip
    if (patterns.length === 0) return 0;

    for (const p of patterns) {
      _patterns.set(p.signature, { ...p });
    }
    return _patterns.size;
  },

  reset(): void {
    _patterns.clear();
    _recentTimestamps.length = 0;
  },

  size(): number { return _patterns.size; },
};
