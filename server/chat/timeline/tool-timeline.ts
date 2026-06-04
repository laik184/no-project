import { timelineManager } from './timeline-manager.ts';
import { eventTimeline }  from './event-timeline.ts';
import type { TimelineEntry } from './event-timeline.ts';

export const toolTimeline = {
  start(runId: string, projectId: number, tool: string, label?: string): TimelineEntry {
    return timelineManager.append(
      runId, projectId, 'tool_call',
      label ?? `Tool: ${tool}`, 'running', { tool },
    );
  },

  succeed(runId: string, _projectId: number, id: number, _label?: string): void {
    eventTimeline.updateStatus(runId, id, 'done');
  },

  fail(runId: string, _projectId: number, id: number, error: string): void {
    eventTimeline.updateStatus(runId, id, 'error', error);
  },

  fileWrite(runId: string, projectId: number, filePath: string): TimelineEntry {
    return timelineManager.append(
      runId, projectId, 'file_write',
      `Write: ${filePath}`, 'done', { filePath },
    );
  },
};
