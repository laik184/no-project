/**
 * server/agents/executor/telemetry/execution-timeline.ts
 *
 * Append-only per-run execution timeline.
 * Records every significant lifecycle event with a timestamp so the full
 * history of a run (planning, steps, retries, validations, recoveries,
 * escalations) can be replayed or exposed via the API.
 *
 * No execution logic. No tool imports.
 */

// ── Event types ───────────────────────────────────────────────────────────────

export type TimelineEventKind =
  | 'planning.started'
  | 'planning.completed'
  | 'planning.failed'
  | 'step.started'
  | 'step.completed'
  | 'step.failed'
  | 'step.retrying'
  | 'step.skipped'
  | 'validation.started'
  | 'validation.passed'
  | 'validation.failed'
  | 'recovery.started'
  | 'recovery.completed'
  | 'recovery.failed'
  | 'rollback.started'
  | 'rollback.completed'
  | 'escalation.triggered'
  | 'parallel.wave.started'
  | 'parallel.wave.completed'
  | 'run.completed'
  | 'run.failed'
  | 'run.cancelled';

export interface TimelineEvent {
  readonly id:      string;
  readonly runId:   string;
  readonly kind:    TimelineEventKind;
  readonly ts:      number;
  readonly label:   string;
  readonly meta?:   Record<string, unknown>;
  readonly durationMs?: number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _timelines = new Map<string, TimelineEvent[]>();
const MAX_EVENTS_PER_RUN = 500;
let   _seq = 0;

function _format(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19); // HH:MM:SS
}

// ── API ───────────────────────────────────────────────────────────────────────

export const executionTimeline = {
  init(runId: string): void {
    if (!_timelines.has(runId)) _timelines.set(runId, []);
  },

  record(
    runId: string,
    kind:  TimelineEventKind,
    label: string,
    meta?: Record<string, unknown>,
    durationMs?: number,
  ): TimelineEvent {
    const events = _timelines.get(runId) ?? [];
    const event: TimelineEvent = {
      id:   `te_${++_seq}`,
      runId, kind, label, meta, durationMs,
      ts:   Date.now(),
    };
    events.push(event);
    if (events.length > MAX_EVENTS_PER_RUN) events.shift();
    _timelines.set(runId, events);
    return event;
  },

  getTimeline(runId: string): TimelineEvent[] {
    return _timelines.get(runId) ?? [];
  },

  /** Return a human-readable log of the timeline. */
  toLog(runId: string): string[] {
    return (this.getTimeline(runId)).map(
      (e) => `[${_format(e.ts)}] ${e.kind.padEnd(28)} ${e.label}` +
             (e.durationMs !== undefined ? ` (${e.durationMs}ms)` : ''),
    );
  },

  /** Return only events of a specific kind. */
  filterByKind(runId: string, kind: TimelineEventKind): TimelineEvent[] {
    return this.getTimeline(runId).filter((e) => e.kind === kind);
  },

  /** Count how many retries occurred for a run. */
  retryCount(runId: string): number {
    return this.filterByKind(runId, 'step.retrying').length;
  },

  /** Count how many recovery attempts occurred. */
  recoveryCount(runId: string): number {
    return this.filterByKind(runId, 'recovery.started').length;
  },

  /** Duration from first event to last event (ms). */
  totalDuration(runId: string): number {
    const events = this.getTimeline(runId);
    if (events.length < 2) return 0;
    return events[events.length - 1].ts - events[0].ts;
  },

  clear(runId: string): void { _timelines.delete(runId); },
  reset():         void { _timelines.clear(); _seq = 0; },
  allRunIds():     string[] { return [..._timelines.keys()]; },
};
