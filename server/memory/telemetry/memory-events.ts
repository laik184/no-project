/**
 * server/memory/telemetry/memory-events.ts
 *
 * Purpose: Typed event emitter for memory platform lifecycle events.
 * Responsibility: Publish and subscribe to memory events.
 *   No external bus dependency — self-contained EventEmitter wrapper.
 * Exports: MemoryEvents, memoryEvents (singleton)
 */

import { EventEmitter } from 'events';
import type { MemoryEvent, MemoryEventType } from '../types/telemetry.types.ts';

type MemoryEventHandler = (event: MemoryEvent) => void;

export class MemoryEvents {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit(event: MemoryEvent): void {
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  on(type: MemoryEventType | '*', handler: MemoryEventHandler): void {
    this.emitter.on(type, handler);
  }

  once(type: MemoryEventType, handler: MemoryEventHandler): void {
    this.emitter.once(type, handler);
  }

  off(type: MemoryEventType | '*', handler: MemoryEventHandler): void {
    this.emitter.off(type, handler);
  }

  listenerCount(type: MemoryEventType | '*'): number {
    return this.emitter.listenerCount(type);
  }
}

export const memoryEvents = new MemoryEvents();
