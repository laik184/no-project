/**
 * test/helpers/test-bus.ts
 *
 * TestBus — isolated in-memory EventEmitter for tests.
 * Replaces the global bus without vi.mock, giving fine-grained control.
 */

import { EventEmitter } from "events";
import { vi }           from "vitest";

export type BusEvent = {
  event:   string;
  payload: unknown;
  ts:      number;
};

export class TestBus extends EventEmitter {
  readonly captured: BusEvent[] = [];
  readonly emitSpy = vi.fn();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /** Emit and capture for assertions. */
  override emit(event: string, ...args: any[]): boolean {
    this.captured.push({ event, payload: args[0], ts: Date.now() });
    this.emitSpy(event, ...args);
    return super.emit(event, ...args);
  }

  /** Get all captured events of a given type. */
  eventsOf(type: string): BusEvent[] {
    return this.captured.filter(e => e.event === type);
  }

  /** Assert at least one event of type was emitted. */
  assertEmitted(type: string): void {
    const found = this.eventsOf(type);
    if (found.length === 0) {
      throw new Error(`Expected event "${type}" to be emitted, but it was not.\nCaptured: ${JSON.stringify(this.captured.map(e => e.event))}`);
    }
  }

  /** Assert event was emitted with matching payload fields. */
  assertEmittedWith(type: string, partial: Record<string, unknown>): void {
    const found = this.eventsOf(type);
    const match = found.some(e => {
      const p = e.payload as Record<string, unknown>;
      return Object.entries(partial).every(([k, v]) => p?.[k] === v);
    });
    if (!match) {
      throw new Error(`Expected "${type}" with ${JSON.stringify(partial)} but got:\n${JSON.stringify(found.map(e => e.payload), null, 2)}`);
    }
  }

  reset(): void {
    this.captured.length = 0;
    this.emitSpy.mockClear();
    this.removeAllListeners();
  }
}

/** Create a fresh TestBus pre-wired as the standard bus mock. */
export function createTestBus(): TestBus {
  return new TestBus();
}
