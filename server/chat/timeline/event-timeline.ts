/**
 * event-timeline.ts — In-memory ordered event timeline per run.
 * Owns: append, query, snapshot for a run's event history.
 */

export type TimelineEntryKind =
  | 'phase'
  | 'tool_call'
  | 'file_write'
  | 'stream'
  | 'question'
  | 'recovery'
  | 'checkpoint'
  | 'lifecycle';

export interface TimelineEntry {
  id:        number;
  runId:     string;
  kind:      TimelineEntryKind;
  label:     string;
  status:    'running' | 'done' | 'error' | 'info';
  phase?:    string;
  tool?:     string;
  filePath?: string;
  error?:    string;
  meta?:     Record<string, unknown>;
  ts:        number;
}

let _entryId = 0;
const _timelines = new Map<string, TimelineEntry[]>();

export const eventTimeline = {
  append(runId: string, entry: Omit<TimelineEntry, 'id' | 'runId'>): TimelineEntry {
    const full: TimelineEntry = { ...entry, id: ++_entryId, runId };
    if (!_timelines.has(runId)) _timelines.set(runId, []);
    _timelines.get(runId)!.push(full);
    return full;
  },

  list(runId: string): TimelineEntry[] {
    return _timelines.get(runId) ?? [];
  },

  last(runId: string): TimelineEntry | null {
    const entries = _timelines.get(runId);
    return entries && entries.length > 0 ? entries[entries.length - 1] : null;
  },

  clear(runId: string): void {
    _timelines.delete(runId);
  },

  /** Update status of a specific entry by id. */
  updateStatus(
    runId:  string,
    id:     number,
    status: TimelineEntry['status'],
    error?: string,
  ): void {
    const entries = _timelines.get(runId);
    if (!entries) return;
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      entry.status = status;
      if (error) entry.error = error;
    }
  },
};
