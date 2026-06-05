/**
 * server/shared/events/bus-adapter.ts
 *
 * Zero-dependency bus adapter for cross-cutting event communication.
 *
 * WHY this exists:
 *   The console domain needs to emit and subscribe to events, but the
 *   architecture contract forbids Console from importing infrastructure/*.
 *   This adapter lives in server/shared/ (zero application imports) and
 *   is initialized once in main.ts registerInfrastructure() with the real
 *   bus instance.  Console modules import ONLY from this file.
 *
 * Dependency rule:
 *   Console  → server/shared/events/bus-adapter.ts   ✓ (shared layer)
 *   main.ts  → infrastructure/index.ts  → init()     ✓ (infra wires it up)
 *   NEVER:   Console → infrastructure/*
 */

// ── Minimal interface — matches TypedEventBus public surface ──────────────────

export interface IBusAdapter {
  emit(event: string, payload: Record<string, unknown>): boolean;
  on(event: string, listener: (payload: Record<string, unknown>) => void): void;
  off(event: string, listener: (payload: Record<string, unknown>) => void): void;
}

// ── Null implementation used before init() is called ─────────────────────────

const nullBus: IBusAdapter = {
  emit: ()  => false,
  on:   ()  => {},
  off:  ()  => {},
};

// ── Singleton adapter ─────────────────────────────────────────────────────────

let _bus: IBusAdapter = nullBus;
let _initialized      = false;

/**
 * Wire the real bus instance.
 * Called ONCE from main.ts registerInfrastructure() — before any console module runs.
 */
export function initBusAdapter(realBus: IBusAdapter): void {
  if (_initialized) return;
  _bus          = realBus;
  _initialized  = true;
}

/** Shared bus facade — safe to import from any layer below Infrastructure. */
export const busAdapter: IBusAdapter = {
  emit(event, payload)          { return _bus.emit(event, payload); },
  on(event, listener)           { _bus.on(event, listener); },
  off(event, listener)          { _bus.off(event, listener); },
};
