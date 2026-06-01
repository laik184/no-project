/**
 * server/file-explorer/realtime/file-events.service.ts
 * High-level event coordination: determines what to publish after each mutation.
 * Called by the orchestrator after successful operations.
 */

import {
  publishCreated,
  publishModified,
  publishDeleted,
  publishRenamed,
  publishUploaded,
} from './file-publisher.ts';
import type { UploadedFile } from '../contracts/index.ts';

class FileEventsService {

  onCreated(path: string, projectId = 0, size?: number): void {
    publishCreated(path, projectId, size);
  }

  onModified(path: string, projectId = 0, size?: number): void {
    publishModified(path, projectId, size);
  }

  onDeleted(path: string, projectId = 0): void {
    publishDeleted(path, projectId);
  }

  onRenamed(oldPath: string, newPath: string, projectId = 0): void {
    publishRenamed(oldPath, newPath, projectId);
  }

  onUploaded(files: UploadedFile[], projectId = 0): void {
    for (const f of files) {
      publishUploaded(f.savedPath, projectId, f.size);
    }
  }
}

export const fileEventsService = new FileEventsService();
