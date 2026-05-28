/**
 * server/agents/executor/learning/learning-governor.ts
 *
 * Enforces hard adaptation boundaries.
 * All learning updates MUST pass through permitUpdate() before being applied.
 * Prevents: runaway adaptation, recursive mutation, governance bypass.
 */

// ── Governance config ─────────────────────────────────────────────────────────

const MAX_UPDATES_PER_WINDOW    = 50;
const UPDATE_WINDOW_MS          = 60_000;    // 1 minute sliding window
const MAX_CONFIDENCE_DELTA      = 0.10;      // max change per update
const MIN_CONFIDENCE            = 0.10;      // floor — never total distrust
const MAX_CONFIDENCE            = 0.95;      // ceiling — never certainty
const MIN_EVIDENCE_TO_ADAPT     = 1;         // any single observation permitted (delta clamping provides protection)
const MAX_STRATEGY_SHIFT_RATE   = 5;         // max strategy changes per window

// ── Audit record ─────────────────────────────────────────────────────────────

export interface GovernanceAuditEntry {
  ts:          number;
  key:         string;
  permitted:   boolean;
  requestedDelta: number;
  actualDelta:    number;
  reason:      string;
}

export interface GovernanceVerdict {
  permitted:   boolean;
  actualDelta: number;
  reason:      string;
}

// ── State ─────────────────────────────────────────────────────────────────────

const _timestamps:     number[] = [];
const _strategyShifts: number[] = [];
const _auditLog:       GovernanceAuditEntry[] = [];
const MAX_AUDIT       = 500;
let   _totalBlocked   = 0;
let   _totalPermitted = 0;

function _recentCount(window: number[], windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return window.filter(t => t >= cutoff).length;
}

function _pruneWindow(window: number[], windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  while (window.length > 0 && window[0] < cutoff) window.shift();
}

function _audit(entry: GovernanceAuditEntry): void {
  if (_auditLog.length >= MAX_AUDIT) _auditLog.shift();
  _auditLog.push(entry);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const learningGovernor = {
  /**
   * Determine whether a proposed learning update is permitted.
   * Returns the permitted (possibly clamped) delta and reason.
   */
  permitUpdate(
    key:            string,
    currentValue:   number,
    proposedDelta:  number,
    evidence:       number,
  ): GovernanceVerdict {
    const now = Date.now();
    _pruneWindow(_timestamps, UPDATE_WINDOW_MS);

    // Hard limit: update rate
    if (_recentCount(_timestamps, UPDATE_WINDOW_MS) >= MAX_UPDATES_PER_WINDOW) {
      const verdict: GovernanceVerdict = {
        permitted: false, actualDelta: 0,
        reason: `Rate limit reached: ${MAX_UPDATES_PER_WINDOW} updates/min`,
      };
      _totalBlocked++;
      _audit({ ts: now, key, permitted: false, requestedDelta: proposedDelta, actualDelta: 0, reason: verdict.reason });
      return verdict;
    }

    // Hard limit: insufficient evidence
    if (evidence < MIN_EVIDENCE_TO_ADAPT) {
      const verdict: GovernanceVerdict = {
        permitted: false, actualDelta: 0,
        reason: `Insufficient evidence: ${evidence} < ${MIN_EVIDENCE_TO_ADAPT} required`,
      };
      _totalBlocked++;
      _audit({ ts: now, key, permitted: false, requestedDelta: proposedDelta, actualDelta: 0, reason: verdict.reason });
      return verdict;
    }

    // Clamp delta to MAX_CONFIDENCE_DELTA
    const clampedDelta = Math.max(-MAX_CONFIDENCE_DELTA, Math.min(MAX_CONFIDENCE_DELTA, proposedDelta));

    // Clamp result to [MIN_CONFIDENCE, MAX_CONFIDENCE]
    const proposed = currentValue + clampedDelta;
    const clamped  = Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, proposed));
    const actual   = clamped - currentValue;

    if (actual === 0) {
      const verdict: GovernanceVerdict = {
        permitted: false, actualDelta: 0,
        reason: `Value already at boundary [${MIN_CONFIDENCE}, ${MAX_CONFIDENCE}]`,
      };
      _totalBlocked++;
      _audit({ ts: now, key, permitted: false, requestedDelta: proposedDelta, actualDelta: 0, reason: verdict.reason });
      return verdict;
    }

    _timestamps.push(now);
    _totalPermitted++;
    const verdict: GovernanceVerdict = {
      permitted: true, actualDelta: actual,
      reason: `Permitted: delta ${actual.toFixed(3)} (evidence: ${evidence})`,
    };
    _audit({ ts: now, key, permitted: true, requestedDelta: proposedDelta, actualDelta: actual, reason: verdict.reason });
    return verdict;
  },

  /**
   * Check whether a strategy shift is permitted (separate budget from value updates).
   */
  permitStrategyShift(strategy: string): GovernanceVerdict {
    const now = Date.now();
    _pruneWindow(_strategyShifts, UPDATE_WINDOW_MS);

    if (_recentCount(_strategyShifts, UPDATE_WINDOW_MS) >= MAX_STRATEGY_SHIFT_RATE) {
      const verdict: GovernanceVerdict = {
        permitted: false, actualDelta: 0,
        reason: `Strategy shift rate limit: ${MAX_STRATEGY_SHIFT_RATE}/min for "${strategy}"`,
      };
      _totalBlocked++;
      _audit({ ts: now, key: strategy, permitted: false, requestedDelta: 1, actualDelta: 0, reason: verdict.reason });
      return verdict;
    }

    _strategyShifts.push(now);
    _totalPermitted++;
    return { permitted: true, actualDelta: 1, reason: `Strategy shift permitted for "${strategy}"` };
  },

  /** Assert that a learning module is NOT attempting orchestration/dispatcher mutation. */
  assertBoundary(moduleName: string, targetSystem: string): void {
    const forbidden = ['orchestrator', 'dispatcher', 'tool-registry', 'governance'];
    for (const f of forbidden) {
      if (targetSystem.toLowerCase().includes(f)) {
        throw new Error(
          `[learning-governor] HARD STOP: ${moduleName} attempted mutation of "${targetSystem}". ` +
          `Learning MUST remain advisory. Governance boundary violated.`,
        );
      }
    }
  },

  auditLog():     GovernanceAuditEntry[] { return [..._auditLog]; },
  totalBlocked(): number                  { return _totalBlocked;  },
  totalPermitted(): number                { return _totalPermitted; },

  stats() {
    return {
      totalPermitted:    _totalPermitted,
      totalBlocked:      _totalBlocked,
      recentUpdates:     _recentCount(_timestamps, UPDATE_WINDOW_MS),
      recentShifts:      _recentCount(_strategyShifts, UPDATE_WINDOW_MS),
      windowCapacity:    MAX_UPDATES_PER_WINDOW,
      strategyCapacity:  MAX_STRATEGY_SHIFT_RATE,
    };
  },

  reset(): void {
    _timestamps.length     = 0;
    _strategyShifts.length = 0;
    _auditLog.length       = 0;
    _totalBlocked   = 0;
    _totalPermitted = 0;
  },
};
