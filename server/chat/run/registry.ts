import { questionManager } from '../questions/question-manager.ts';
import { contextCache }    from '../context/context-cache.ts';
import { eventTimeline }   from '../timeline/event-timeline.ts';
import { turnManager, streamManager } from '@services/chat';

export function unregisterRun(runId: string): void {
  questionManager.cancelByRun(runId);
  contextCache.delete(runId);
  eventTimeline.clear(runId);
  if (streamManager.isActive(runId)) streamManager.close(runId);
  turnManager.clearCompleted();
}
