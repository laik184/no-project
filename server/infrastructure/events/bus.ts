/**
 * server/infrastructure/events/bus.ts
 *
 * Central typed event bus for the application.
 * All inter-module event communication flows through this bus.
 * Backed by Node.js EventEmitter — in-process only.
 */
import { EventEmitter } from 'events';

// ── Typed event map ────────────────────────────────────────────────────────────

export interface BusEventMap {
  'agent.event':          Record<string, unknown>;
  'run.lifecycle':        Record<string, unknown>;
  'checkpoint':           Record<string, unknown>;
  'process.crashed':      Record<string, unknown>;
  'console.log_line':     Record<string, unknown>;
  'console.runtime_state': Record<string, unknown>;
  'console.session_open': Record<string, unknown>;
  'console.session_close': Record<string, unknown>;
  [key: string]:          unknown;
}

// ── Bus implementation ────────────────────────────────────────────────────────

class TypedEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<K extends keyof BusEventMap>(event: K, payload: BusEventMap[K]): boolean {
    return this.emitter.emit(event as string, payload);
  }

  on<K extends keyof BusEventMap>(
    event: K,
    listener: (payload: BusEventMap[K]) => void,
  ): this {
    this.emitter.on(event as string, listener as (...args: unknown[]) => void);
    return this;
  }

  once<K extends keyof BusEventMap>(
    event: K,
    listener: (payload: BusEventMap[K]) => void,
  ): this {
    this.emitter.once(event as string, listener as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof BusEventMap>(
    event: K,
    listener: (payload: BusEventMap[K]) => void,
  ): this {
    this.emitter.off(event as string, listener as (...args: unknown[]) => void);
    return this;
  }

  listenerCount(event: keyof BusEventMap): number {
    return this.emitter.listenerCount(event as string);
  }
}

export const bus = new TypedEventBus();
