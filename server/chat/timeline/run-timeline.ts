import { timelineManager } from './timeline-manager.ts';
import { eventTimeline }   from './event-timeline.ts';
import type { TimelineEntry } from './event-timeline.ts';

export const runTimeline = {
  startPhase(runId: string, projectId: number, phase: string): TimelineEntry {
    return timelineManager.append(runId, projectId, 'phase', `Phase: ${phase}`, 'running', { phase });
  },

  endPhase(runId: string, _projectId: number, phase: string, status: TimelineEntry['status']): void {
    const entries = timelineManager.getEntries(runId);
    const entry   = [...entries].reverse().find((e) => e.kind === 'phase' && e.phase === phase);
    if (entry) {
      eventTimeline.updateStatus(runId, entry.id, status);
    }
  },

  recordRecovery(runId: string, projectId: number, label: string): TimelineEntry {
    return timelineManager.append(runId, projectId, 'recovery', label, 'info');
  },

  recordLifecycle(runId: string, projectId: number, label: string): TimelineEntry {
    return timelineManager.append(runId, projectId, 'lifecycle', label, 'done');
  },
};
