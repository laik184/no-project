import { makeTimelineEvent }  from '../events/timeline.events.ts';
import { eventPublisher }     from '../realtime/event-publisher.ts';
import type { TimelineEntry } from './event-timeline.ts';

export const timelinePublisher = {
  publish(runId: string, projectId: number, entry: TimelineEntry): void {
    eventPublisher.publish(
      makeTimelineEvent(runId, projectId, entry) as Record<string, unknown>,
    );
  },
};
