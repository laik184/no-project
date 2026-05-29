/**
 * timeline-manager.ts — Coordinates timeline across run/tool sub-timelines.
 * Single entry point for external code to append timeline events.
 */
import { eventTimeline, type TimelineEntry, type TimelineEntryKind } from './event-timeline.ts';
import { timelinePublisher } from './timeline-publisher.ts';

export const timelineManager = {
  /**
   * Append any timeline entry and publish it to SSE.
   */
  append(
    runId:     string,
    projectId: number,
    kind:      TimelineEntryKind,
    label:     string,
    status:    TimelineEntry['status'],
    extra?:    Partial<Omit<TimelineEntry, 'id' | 'runId' | 'kind' | 'label' | 'status' | 'ts'>>,
  ): TimelineEntry {
    const entry = eventTimeline.append(runId, {
      kind,
      label,
      status,
      ts: Date.now(),
      ...extra,
    });

    timelinePublisher.publish(runId, projectId, entry);
    return entry;
  },

  /**
   * Get all timeline entries for a run.
   */
  getEntries(runId: string): TimelineEntry[] {
    return eventTimeline.list(runId);
  },

  /**
   * Clear timeline for a run (call after run is finalized + persisted).
   */
  clear(runId: string): void {
    eventTimeline.clear(runId);
  },
};
