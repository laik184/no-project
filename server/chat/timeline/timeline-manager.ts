import { eventTimeline, type TimelineEntry, type TimelineEntryKind } from './event-timeline.ts';
import { timelinePublisher } from './timeline-publisher.ts';

export const timelineManager = {
  append(
    runId:     string,
    projectId: number,
    kind:      TimelineEntryKind,
    label:     string,
    status:    TimelineEntry['status'],
    extra?:    Partial<Omit<TimelineEntry, 'id' | 'runId' | 'kind' | 'label' | 'status' | 'ts'>>,
  ): TimelineEntry {
    const entry = eventTimeline.append(runId, { kind, label, status, ts: Date.now(), ...extra });
    timelinePublisher.publish(runId, projectId, entry);
    return entry;
  },

  getEntries(runId: string): TimelineEntry[] {
    return eventTimeline.list(runId);
  },

  clear(runId: string): void {
    eventTimeline.clear(runId);
  },
};
