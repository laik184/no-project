/**
 * server/agents/executor/telemetry/adaptation-tracer.ts
 *
 * Audit trail for all adaptation decisions made by the learning system.
 * Records WHAT changed, WHY it changed, WHEN, and what evidence drove it.
 * Append-only, bounded, deterministic — never modifies any system state.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdaptationKind =
  | 'tool-reliability-updated'
  | 'strategy-shifted'
  | 'risk-score-changed'
  | 'workflow-hint-generated'
  | 'browser-pattern-recorded'
  | 'feedback-cycle-completed'
  | 'governor-blocked'
  | 'learning-reset';

export interface AdaptationEvent {
  readonly id:          string;
  readonly kind:        AdaptationKind;
  readonly ts:          number;
  readonly subject:     string;        // tool name, strategy name, route, etc.
  readonly previousValue?: number;
  readonly newValue?:      number;
  readonly delta?:         number;
  readonly evidence:       number;     // observations backing this change
  readonly reason:         string;     // human-readable
  readonly runId?:         string;
  readonly governed:       boolean;    // was this passed through the governor?
}

export interface AdaptationSummary {
  totalEvents:     number;
  byKind:          Record<AdaptationKind, number>;
  recentEvents:    AdaptationEvent[];
  biggestShifts:   AdaptationEvent[];
  blockedCount:    number;
  governedCount:   number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _events: AdaptationEvent[] = [];
const MAX_EVENTS = 1_000;
let   _seq       = 0;

function _makeId(): string { return `adapt_${++_seq}`; }

// ── Public API ────────────────────────────────────────────────────────────────

export const adaptationTracer = {
  /** Record an adaptation event. Returns the immutable event. */
  record(params: Omit<AdaptationEvent, 'id' | 'ts'>): AdaptationEvent {
    if (_events.length >= MAX_EVENTS) _events.shift();
    const event: AdaptationEvent = {
      id:  _makeId(),
      ts:  Date.now(),
      ...params,
    };
    _events.push(event);
    return event;
  },

  /** Convenience: record a tool reliability update. */
  recordToolUpdate(
    toolName:     string,
    prevValue:    number,
    newValue:     number,
    evidence:     number,
    reason:       string,
    runId?:       string,
  ): AdaptationEvent {
    return this.record({
      kind:          'tool-reliability-updated',
      subject:       toolName,
      previousValue: prevValue,
      newValue,
      delta:         newValue - prevValue,
      evidence,
      reason,
      runId,
      governed:      true,
    });
  },

  /** Convenience: record a strategy shift. */
  recordStrategyShift(
    fromStrategy: string,
    toStrategy:   string,
    kind:         string,
    reason:       string,
    confidence:   number,
  ): AdaptationEvent {
    return this.record({
      kind:     'strategy-shifted',
      subject:  `${kind}::${fromStrategy}→${toStrategy}`,
      newValue: confidence,
      evidence: 1,
      reason,
      governed: true,
    });
  },

  /** Convenience: record a governor block. */
  recordBlock(key: string, reason: string, requestedDelta: number): AdaptationEvent {
    return this.record({
      kind:     'governor-blocked',
      subject:  key,
      delta:    requestedDelta,
      evidence: 0,
      reason,
      governed: true,
    });
  },

  /** Convenience: record a feedback cycle completion. */
  recordFeedbackCycle(
    runId:       string,
    score:       number,
    grade:       string,
    patterns:    number,
    storeVersion: number,
  ): AdaptationEvent {
    return this.record({
      kind:     'feedback-cycle-completed',
      subject:  `run::${runId}`,
      newValue: score,
      evidence: patterns,
      reason:   `Grade ${grade} — ${patterns} patterns learned — store v${storeVersion}`,
      runId,
      governed: true,
    });
  },

  /** All events since a given timestamp. */
  since(afterMs: number): AdaptationEvent[] {
    return _events.filter(e => e.ts > afterMs);
  },

  /** Events for a specific subject (tool/strategy/route). */
  forSubject(subject: string): AdaptationEvent[] {
    return _events.filter(e => e.subject.includes(subject));
  },

  /** Human-readable trace for a subject (for debugging/observability). */
  trace(subject: string): string {
    const events = this.forSubject(subject);
    if (events.length === 0) return `No adaptation history for "${subject}"`;
    return events.map(e => {
      const ts    = new Date(e.ts).toISOString();
      const delta = e.delta !== undefined ? ` Δ${e.delta > 0 ? '+' : ''}${e.delta.toFixed(3)}` : '';
      const val   = e.newValue !== undefined ? ` → ${e.newValue.toFixed(3)}` : '';
      return `[${ts}] ${e.kind} subject=${e.subject}${delta}${val}: ${e.reason}`;
    }).join('\n');
  },

  /** Full summary for telemetry / API. */
  summary(): AdaptationSummary {
    const byKind = {} as Record<AdaptationKind, number>;
    let blockedCount  = 0;
    let governedCount = 0;

    for (const e of _events) {
      byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
      if (e.kind === 'governor-blocked') blockedCount++;
      if (e.governed)                    governedCount++;
    }

    const biggestShifts = [..._events]
      .filter(e => e.delta !== undefined)
      .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
      .slice(0, 5);

    return {
      totalEvents:  _events.length,
      byKind,
      recentEvents: _events.slice(-10),
      biggestShifts,
      blockedCount,
      governedCount,
    };
  },

  /** Plain-text report of recent adaptations. */
  recentReport(n = 10): string {
    const recent = _events.slice(-n);
    if (recent.length === 0) return 'No adaptation events recorded yet.';
    return recent.map(e => {
      const ts    = new Date(e.ts).toISOString().slice(11, 23);
      const delta = e.delta !== undefined ? ` (Δ${e.delta > 0 ? '+' : ''}${e.delta.toFixed(3)})` : '';
      return `${ts} [${e.kind}] ${e.subject}${delta} — ${e.reason}`;
    }).join('\n');
  },

  size():  number { return _events.length; },
  reset(): void   { _events.length = 0; _seq = 0; },
};
