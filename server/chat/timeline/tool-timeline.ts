/**
 * tool-timeline.ts — Records tool call lifecycle events in the timeline.
 */
import { eventTimeline } from './event-timeline.ts';
import type { TimelineEntry } from './event-timeline.ts';

export const toolTimeline = {
  recordStarted(
    runId:  string,
    tool:   string,
    phase?: string,
    args?:  Record<string, unknown>,
  ): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:   'tool_call',
      label:  `${tool}${phase ? ` [${phase}]` : ''}`,
      status: 'running',
      phase,
      tool,
      meta:   args ? { args } : undefined,
      ts:     Date.now(),
    });
  },

  recordCompleted(runId: string, entryId: number, result?: unknown): void {
    eventTimeline.updateStatus(runId, entryId, 'done');
    const entries = eventTimeline.list(runId);
    const entry = entries.find((e) => e.id === entryId);
    if (entry && result !== undefined) {
      entry.meta = { ...entry.meta, result };
    }
  },

  recordFailed(runId: string, entryId: number, error: string): void {
    eventTimeline.updateStatus(runId, entryId, 'error', error);
  },

  recordFileWrite(runId: string, filePath: string): TimelineEntry {
    return eventTimeline.append(runId, {
      kind:     'file_write',
      label:    `Wrote ${filePath}`,
      status:   'done',
      filePath,
      ts:       Date.now(),
    });
  },
};
