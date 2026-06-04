import type { TimelineEntry } from '../timeline/event-timeline.ts';

export interface TimelinePublishedEvent {
  eventType: 'chat.timeline.event';
  runId:     string;
  projectId: number;
  entry:     TimelineEntry;
  ts:        number;
}

export function makeTimelineEvent(
  runId:     string,
  projectId: number,
  entry:     TimelineEntry,
): TimelinePublishedEvent {
  return { eventType: 'chat.timeline.event', runId, projectId, entry, ts: Date.now() };
}
