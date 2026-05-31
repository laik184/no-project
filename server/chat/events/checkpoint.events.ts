/**
 * server/chat/events/checkpoint.events.ts
 * Event factories for checkpoint SSE payloads.
 */
import type { CheckpointSSEPayload, ChatCheckpoint } from '../types/checkpoint.types.ts';

export function makeCheckpointCreatedPayload(
  cp: ChatCheckpoint,
): CheckpointSSEPayload {
  return {
    eventType:    'checkpoint.created',
    checkpointId: cp.id,
    runId:        cp.runId,
    projectId:    cp.projectId,
    title:        cp.title,
    description:  cp.description,
    timestamp:    cp.createdAt.toISOString(),
    filesChanged: cp.filesChanged,
    createdFiles: cp.createdFiles,
    modifiedFiles:cp.modifiedFiles,
    deletedFiles: cp.deletedFiles,
  };
}

export function makeCheckpointRollbackPayload(
  checkpointId: string,
  runId:        string,
  projectId:    number,
): CheckpointSSEPayload {
  return {
    eventType:    'checkpoint.rollback',
    checkpointId,
    runId,
    projectId,
    title:        'Rollback',
    description:  `Rolled back to checkpoint ${checkpointId}`,
    timestamp:    new Date().toISOString(),
    filesChanged: 0,
    createdFiles: [],
    modifiedFiles:[],
    deletedFiles: [],
  };
}
