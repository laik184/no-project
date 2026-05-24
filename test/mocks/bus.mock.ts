/**
 * test/mocks/bus.mock.ts
 *
 * Reusable vi.mock factory for server/infrastructure/events/bus.ts
 *
 * Usage in test files:
 *   vi.mock("../../server/infrastructure/events/bus.ts", busMockFactory);
 *   import { bus } from "../../server/infrastructure/events/bus.ts";
 *   // bus.emit is now a vi.fn() — assert via bus.emit.mock.calls
 */

import { vi } from "vitest";

/** Standard mock factory — use as second arg to vi.mock(). */
export const busMockFactory = () => ({
  bus: {
    emit:              vi.fn(),
    on:                vi.fn(),
    once:              vi.fn(),
    off:               vi.fn(),
    removeAllListeners: vi.fn(),
    subscribe:         vi.fn().mockReturnValue(() => {}),
    listenerCount:     vi.fn().mockReturnValue(0),
  },
});

/** Mock factory for tests that need bus.on to fire callbacks. */
export function makeReactiveBusMock() {
  const listeners = new Map<string, Array<(...args: any[]) => void>>();

  const mock = {
    emit: vi.fn((event: string, payload: unknown) => {
      listeners.get(event)?.forEach(fn => fn(payload));
      return true;
    }),
    on: vi.fn((event: string, fn: (...args: any[]) => void) => {
      const fns = listeners.get(event) ?? [];
      fns.push(fn);
      listeners.set(event, fns);
      return mock;
    }),
    off: vi.fn((event: string, fn: (...args: any[]) => void) => {
      const fns = listeners.get(event) ?? [];
      listeners.set(event, fns.filter(f => f !== fn));
      return mock;
    }),
    once: vi.fn((event: string, fn: (...args: any[]) => void) => {
      const wrapper = (...args: any[]) => {
        fn(...args);
        mock.off(event, wrapper);
      };
      mock.on(event, wrapper);
      return mock;
    }),
    removeAllListeners: vi.fn(() => { listeners.clear(); return mock; }),
    subscribe: vi.fn((event: string, fn: (...args: any[]) => void) => {
      mock.on(event, fn);
      return () => mock.off(event, fn);
    }),
    listenerCount: vi.fn((event: string) => listeners.get(event)?.length ?? 0),
    _fire: (event: string, payload: unknown) => mock.emit(event, payload),
    _reset: () => {
      listeners.clear();
      Object.values(mock).forEach(v => { if (typeof (v as any)?.mockClear === "function") (v as any).mockClear(); });
    },
  };
  return { bus: mock };
}
