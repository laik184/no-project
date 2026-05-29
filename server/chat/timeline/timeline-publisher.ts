/**
 * timeline-publisher.ts — Publishes timeline entries to the event bus.
 */
import { eventPublisher }          from '../realtime/event-publisher.ts';
import { makeTimelinePublishedEvent } from '../events/timeline.events.ts';
import type { TimelineEntry }      from './event-timeline.ts';

export const timelinePublisher = {
  publish(runId: string, projectId: number, entry: TimelineEntry): void {
    eventPublisher.publish(makeTimelinePublishedEvent(runId, projectId, entry));
  },
};
