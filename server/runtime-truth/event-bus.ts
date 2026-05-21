/**
 * server/runtime-truth/event-bus.ts
 *
 * RuntimeEventBus — typed, immutable, sequenced event bus.
 * Events are frozen on creation. Sequence numbers are monotonic.
 * No shared mutable state beyond the internal subscriber map.
 * Listeners never mutate events.
 */

import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { RuntimeEvent, RuntimeEventKind } from "./types.ts";

type EventHandler = (event: RuntimeEvent) => void;

// ─── Monotonic sequence counter ───────────────────────────────────────────────

let _seq = 0;
function nextSeq(): number {
  return ++_seq;
}

// ─── Bus ─────────────────────────────────────────────────────────────────────

export class RuntimeEventBus {
  private readonly _emitter = new EventEmitter();
  private readonly _history: RuntimeEvent[] = [];
  private readonly _maxHistory: number;

  constructor(maxHistory = 500) {
    this._maxHistory = maxHistory;
    this._emitter.setMaxListeners(64);
  }

  emit(
    kind: RuntimeEventKind,
    correlationId: string,
    payload: Record<string, unknown> = {}
  ): RuntimeEvent {
    const event: RuntimeEvent = Object.freeze({
      id: randomUUID(),
      kind,
      correlationId,
      timestamp: Date.now(),
      sequenceNo: nextSeq(),
      payload: Object.freeze({ ...payload }),
    });

    this._history.push(event);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    this._emitter.emit(kind, event);
    this._emitter.emit("*", event);
    return event;
  }

  on(kind: RuntimeEventKind | "*", handler: EventHandler): () => void {
    this._emitter.on(kind, handler);
    return () => this._emitter.off(kind, handler);
  }

  once(kind: RuntimeEventKind, handler: EventHandler): void {
    this._emitter.once(kind, handler);
  }

  history(kind?: RuntimeEventKind): ReadonlyArray<RuntimeEvent> {
    if (!kind) return Object.freeze([...this._history]);
    return Object.freeze(this._history.filter((e) => e.kind === kind));
  }

  lastOf(kind: RuntimeEventKind): RuntimeEvent | null {
    for (let i = this._history.length - 1; i >= 0; i--) {
      if (this._history[i].kind === kind) return this._history[i];
    }
    return null;
  }

  replay(
    fromSequenceNo: number,
    handler: EventHandler
  ): void {
    for (const evt of this._history) {
      if (evt.sequenceNo >= fromSequenceNo) handler(evt);
    }
  }
}

// ─── Process-scoped singleton bus ─────────────────────────────────────────────

export const runtimeEventBus = new RuntimeEventBus();
