/**
 * run-timeline.ts — Records run-level lifecycle events in the timeline.
 */
import { eventTimeline } from './event-timeline.ts';
import type { TimelineEntry } from './event-timeline.ts';

export const runTimeline = {
  recordStarted(runId: string, goal: string, projectId: number): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'lifecycle',
      label:  `Run started — "${goal.slice(0, 60)}${goal.length > 60 ? '…' : ''}"`,
      status: 'running',
      meta:   { projectId },
      ts:     Date.now(),
    });
  },

  recordCompleted(runId: string, durationMs: number): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'lifecycle',
      label:  `Run completed in ${(durationMs / 1000).toFixed(1)}s`,
      status: 'done',
      meta:   { durationMs },
      ts:     Date.now(),
    });
  },

  recordFailed(runId: string, error: string): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'lifecycle',
      label:  `Run failed: ${error.slice(0, 120)}`,
      status: 'error',
      error,
      ts:     Date.now(),
    });
  },

  recordCancelled(runId: string): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'lifecycle',
      label:  'Run cancelled',
      status: 'info',
      ts:     Date.now(),
    });
  },

  recordPhaseStarted(runId: string, phase: string, label: string): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'phase',
      label,
      status: 'running',
      phase,
      ts:     Date.now(),
    });
  },

  recordPhaseCompleted(runId: string, entryId: number): void {
    eventTimeline.updateStatus(runId, entryId, 'done');
  },

  recordPhaseFailed(runId: string, entryId: number, error: string): void {
    eventTimeline.updateStatus(runId, entryId, 'error', error);
  },

  recordCheckpoint(runId: string, label: string): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'checkpoint',
      label:  `Checkpoint: ${label}`,
      status: 'info',
      ts:     Date.now(),
    });
  },

  recordRecoveryStarted(runId: string, attempt: number): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'recovery',
      label:  `Self-healing: attempt ${attempt}`,
      status: 'running',
      ts:     Date.now(),
    });
  },

  recordRecoveryCompleted(runId: string, entryId: number, steps: number): void {
    const entries = eventTimeline.list(runId);
    const entry = entries.find((e) => e.id === entryId);
    if (entry) {
      entry.status = 'done';
      entry.label  = `Self-healed in ${steps} step${steps !== 1 ? 's' : ''}`;
    }
  },
};
