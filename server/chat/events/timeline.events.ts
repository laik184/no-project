/**
 * timeline.events.ts — Timeline entry event factories.
 */
import { CHAT_EVENT } from '../constants/event.constants.ts';
import type { TimelineEntry } from '../timeline/event-timeline.ts';

export interface TimelinePublishedEvent {
  type:      typeof CHAT_EVENT.TIMELINE_EVENT;
  runId:     string;
  projectId: number;
  entry:     TimelineEntry;
  ts:        number;
}

export function makeTimelinePublishedEvent(
  runId:     string,
  projectId: number,
  entry:     TimelineEntry,
): TimelinePublishedEvent {
  return { type: CHAT_EVENT.TIMELINE_EVENT, runId, projectId, entry, ts: Date.now() };
}
