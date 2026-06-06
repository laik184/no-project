/**
 * server/agents/executor/memory/failure-memory.ts
 *
 * Tracks failure patterns per tool/kind, chronic failure detection, and
 * retry-storm detection. Sync reads — no async on the hot path.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type FailureCategory =
  | 'transient'
  | 'chronic'
  | 'storm'
  | 'unknown';

export interface FailurePattern {
  readonly toolName:   string;
  readonly kind:       string;
  readonly occurrences: number;
  readonly lastError:  string;
  readonly lastSeen:   number;
  readonly category:   FailureCategory;
}

export interface FailureAnalysis {
  readonly pattern:     FailurePattern;
  readonly isChronicle: boolean;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STORM_WINDOW_MS   = 30_000;
const STORM_THRESHOLD   = 8;
const CHRONIC_THRESHOLD = 3;

// ── Internal state ────────────────────────────────────────────────────────────

interface _Record {
  toolName:    string;
  kind:        string;
  occurrences: number;
  lastError:   string;
  lastSeen:    number;
  recentTs:    number[];
}

const _patterns = new Map<string, _Record>();

function _key(toolName: string, kind: string): string {
  return `${toolName}::${kind}`;
}

function _classify(rec: _Record): FailureCategory {
  const now     = Date.now();
  const recent  = rec.recentTs.filter(t => now - t < STORM_WINDOW_MS).length;
  if (recent >= STORM_THRESHOLD)    return 'storm';
  if (rec.occurrences >= CHRONIC_THRESHOLD) return 'chronic';
  return rec.occurrences <= 1 ? 'transient' : 'unknown';
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const failureMemory = {

  recordFailurePattern(
    _runId:   string,
    toolName: string,
    kind:     string,
    error:    string,
  ): void {
    const k   = _key(toolName, kind);
    const now = Date.now();
    const rec = _patterns.get(k);
    if (rec) {
      rec.occurrences += 1;
      rec.lastError    = error;
      rec.lastSeen     = now;
      rec.recentTs.push(now);
      if (rec.recentTs.length > 100) rec.recentTs.splice(0, 50);
    } else {
      _patterns.set(k, {
        toolName, kind,
        occurrences: 1,
        lastError:   error,
        lastSeen:    now,
        recentTs:    [now],
      });
    }
  },

  analyze(
    _runId:   string,
    toolName: string,
    kind:     string,
    error:    string,
  ): FailureAnalysis {
    const k   = _key(toolName, kind);
    const rec = _patterns.get(k) ?? {
      toolName, kind,
      occurrences: 0,
      lastError:   error,
      lastSeen:    Date.now(),
      recentTs:    [],
    };
    const category    = _classify(rec);
    const isChronicle = rec.occurrences >= CHRONIC_THRESHOLD;
    const pattern: FailurePattern = {
      toolName:    rec.toolName,
      kind:        rec.kind,
      occurrences: rec.occurrences,
      lastError:   rec.lastError,
      lastSeen:    rec.lastSeen,
      category,
    };
    return { pattern, isChronicle };
  },

  chroniclePatterns(): FailurePattern[] {
    return [..._patterns.values()]
      .filter(r => r.occurrences >= CHRONIC_THRESHOLD)
      .map(r => ({
        toolName:    r.toolName,
        kind:        r.kind,
        occurrences: r.occurrences,
        lastError:   r.lastError,
        lastSeen:    r.lastSeen,
        category:    _classify(r),
      }));
  },

  isRetryStorm(): boolean {
    const now = Date.now();
    let recentTotal = 0;
    for (const rec of _patterns.values()) {
      recentTotal += rec.recentTs.filter(t => now - t < STORM_WINDOW_MS).length;
    }
    return recentTotal >= STORM_THRESHOLD;
  },

  clear(): void {
    _patterns.clear();
  },
};
