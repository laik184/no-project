import type { ChatCheckpoint } from '../types/checkpoint.types.ts';

export interface CheckpointSSEPayload {
  eventType:    string;
  checkpointId: string;
  runId?:       string;
  projectId:    number;
  ts:           number;
  checkpoint?:  ChatCheckpoint;
}

export interface CheckpointDeleteEvent {
  eventType:    string;
  checkpointId: string;
  projectId:    number;
  ts:           number;
}

export function makeCheckpointCreatedPayload(cp: ChatCheckpoint): CheckpointSSEPayload {
  return {
    eventType:    'checkpoint.created',
    checkpointId: cp.id,
    runId:        cp.runId,
    projectId:    cp.projectId,
    ts:           Date.now(),
    checkpoint:   cp,
  };
}

export function makeCheckpointRollbackPayload(
  checkpointId: string,
  runId:        string,
  projectId:    number,
): CheckpointSSEPayload {
  return { eventType: 'checkpoint.rollback', checkpointId, runId, projectId, ts: Date.now() };
}

export function makeCheckpointDeletedEvent(
  checkpointId: string,
  projectId:    number,
): CheckpointDeleteEvent {
  return { eventType: 'checkpoint.deleted', checkpointId, projectId, ts: Date.now() };
}
