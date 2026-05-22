/**
 * Responsibility: Routes distributed lifecycle events to the correct downstream handlers
 *                 based on event type and worker/run context. Replaces ad-hoc bus.on() calls
 *                 scattered across the distributed layer with a single typed routing table.
 * Dependencies: bus
 * Failure: unroutable events are logged and dropped; router never throws.
 * Telemetry: every routed event is counted; missed routes are tracked for observability.
 */

import { bus } from "./bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DistributedEventType =
  | "worker.started"
  | "worker.completed"
  | "worker.failed"
  | "queue.blocked"
  | "sync.wait"
  | "lock.acquired"
  | "lock.released"
  | "distributed.retry"
  | "distributed.recovery"
  | "distributed.consensus"
  | "distributed.conflict"
  | "distributed.collapse";

export type DistributedEventHandler = (payload: Record<string, unknown>, runId: string) => void;

// ── Router ────────────────────────────────────────────────────────────────────

class DistributedEventRouter {
  private readonly routes = new Map<DistributedEventType, DistributedEventHandler[]>();
  private readonly metrics = { routed: 0, missed: 0 };

  /** Register a handler for a distributed event type. */
  on(eventType: DistributedEventType, handler: DistributedEventHandler): void {
    const existing = this.routes.get(eventType) ?? [];
    this.routes.set(eventType, [...existing, handler]);
  }

  /** Remove a handler. */
  off(eventType: DistributedEventType, handler: DistributedEventHandler): void {
    const existing = this.routes.get(eventType) ?? [];
    this.routes.set(eventType, existing.filter(h => h !== handler));
  }

  /** Initialize the router — wire it to the main event bus. */
  init(): void {
    bus.on("agent.event" as any, (event: {
      eventType?: string;
      payload?:   Record<string, unknown>;
      runId?:     string;
    }) => {
      const type    = event.eventType as DistributedEventType | undefined;
      const payload = event.payload ?? {};
      const runId   = event.runId ?? "unknown";

      if (!type) return;

      const handlers = this.routes.get(type);
      if (!handlers || handlers.length === 0) {
        this.metrics.missed++;
        return;
      }

      this.metrics.routed++;
      for (const handler of handlers) {
        try {
          handler(payload, runId);
        } catch (err) {
          console.error(`[distributed-event-router] Handler error for "${type}":`, err);
        }
      }
    });

    console.log("[distributed-event-router] Initialized — wired to event bus.");
  }

  stats() {
    return {
      routes:     [...this.routes.keys()],
      routeCount: this.routes.size,
      ...this.metrics,
    };
  }
}

export const distributedEventRouter = new DistributedEventRouter();
