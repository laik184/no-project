import { eventBus } from '../../../infrastructure/event-bus/index.ts';
import type { FsOperationStarted, FsOperationCompleted, FsFileChanged, FsAgentReady } from './event-types.ts';

export const FilesystemEvents = {
  AGENT_READY:        'filesystem.agent.ready',
  OPERATION_STARTED:  'filesystem.operation.started',
  OPERATION_DONE:     'filesystem.operation.completed',
  FILE_CHANGED:       'filesystem.file.changed',
} as const;

export function emitAgentReady(payload: FsAgentReady): void {
  eventBus.emit(FilesystemEvents.AGENT_READY, payload);
}

export function emitOperationStarted(payload: FsOperationStarted): void {
  eventBus.emit(FilesystemEvents.OPERATION_STARTED, payload);
}

export function emitOperationDone(payload: FsOperationCompleted): void {
  eventBus.emit(FilesystemEvents.OPERATION_DONE, payload);
}

export function emitFileChanged(payload: FsFileChanged): void {
  eventBus.emit(FilesystemEvents.FILE_CHANGED, payload);
}
