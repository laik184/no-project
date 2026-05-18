/**
 * bus.ts — typed singleton event bus.
 *
 * All event payload interfaces live in types/event.types.ts and are
 * re-exported here for backward compatibility (existing code that imports
 * directly from this file continues to work without changes).
 *
 * setMaxListeners is NOT called here. The hub pattern in
 * core/subscription-manager.ts ensures exactly ONE listener per event
 * type regardless of connected client count, so the default Node.js limit
 * is never approached. subscription-manager.ts calls bus.setMaxListeners(0)
 * to suppress any spurious warnings from other (non-SSE) bus.on() callers.
 */

import { EventEmitter } from "events";
import type { BusEvents } from "./types/event.types.ts";

// Re-export all event types — consumers that import from this file continue
// to receive the same interface names without any changes.
export type {
  AgentEvent,
  RunLifecycleEvent,
  ConsoleLogEvent,
  FileChangeEvent,
  RuntimeVerifiedEvent,
  RuntimeObservationEvent,
  DebugLifecycleEvent,
  ToolExecutionEvent,
  AgentDiffEvent,
  CheckpointEvent,
  BusEvents,
} from "./types/event.types.ts";

// ── TypedEventEmitter ─────────────────────────────────────────────────────────

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof BusEvents>(event: K, ...args: Parameters<BusEvents[K]>): boolean {
    return super.emit(event as string, ...args);
  }
  on<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): this {
    return super.on(event as string, listener as (...args: any[]) => void);
  }
  once<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): this {
    return super.once(event as string, listener as (...args: any[]) => void);
  }
  off<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): this {
    return super.off(event as string, listener as (...args: any[]) => void);
  }

  /**
   * Subscribe to an event and return a typed unsubscribe function.
   *
   * For SSE route handlers: do NOT use this directly. Use sseManager.register()
   * which participates in the hub fan-out pattern.
   *
   * Legitimate callers: console-log-persister, crash-responder, observation-
   * controller, event-persist — non-SSE system services that each add exactly
   * one permanent listener and never remove it.
   */
  subscribe<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): () => void {
    super.on(event as string, listener as (...args: any[]) => void);
    return () => super.off(event as string, listener as (...args: any[]) => void);
  }
}

export const bus = new TypedEventEmitter();
