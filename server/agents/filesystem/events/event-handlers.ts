import { eventBus } from '../../../infrastructure/event-bus/index.ts';
import { filesystemEngine } from '../core/filesystem-engine.ts';

export function registerFilesystemEventHandlers(): void {
  eventBus.on('run.started', async ({ runId, projectId }: { runId: string; projectId: string }) => {
    await filesystemEngine.initSession(runId, projectId);
  });

  eventBus.on('run.finished', ({ runId }: { runId: string }) => {
    filesystemEngine.closeSession(runId);
  });

  eventBus.on('run.failed', ({ runId }: { runId: string }) => {
    filesystemEngine.closeSession(runId);
  });
}
