/**
 * server/infrastructure/events/file-change-emitter.ts
 *
 * Emits file change events onto the infrastructure bus.
 * Consumed by file-explorer and any module watching workspace changes.
 */
import { bus } from './bus.ts';

export interface FileChangeEvent {
  readonly projectId: number;
  readonly path:      string;
  readonly kind:      'created' | 'modified' | 'deleted' | 'renamed';
  readonly ts:        number;
}

export function emitFileChange(event: Omit<FileChangeEvent, 'ts'>): void {
  bus.emit('agent.event', { ...event, ts: Date.now(), type: 'file.change' });
}
