/**
 * Responsibility: Bridges the in-process event bus to a future external transport
 *                 (Redis Pub/Sub, NATS, etc.) without changing internal emitter code.
 *                 Currently implements in-process fan-out with Redis-ready interface.
 * Dependencies: bus, distributed-event-router
 * Failure: transport errors are logged; bridge falls back to local-only delivery.
 * Telemetry: all forwarded events counted; transport errors tracked separately.
 */

import { bus }                    from "./bus.ts";
import { distributedEventRouter } from "./distributed-event-router.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExternalTransport {
  publish(channel: string, payload: string): Promise<void>;
  subscribe(channel: string, handler: (msg: string) => void): Promise<void>;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class DistributedEventBridge {
  private transport: ExternalTransport | null = null;
  private readonly metrics = { forwarded: 0, failed: 0, localOnly: 0 };

  /** Attach an external transport (Redis/NATS/etc.). Optional — local mode works without it. */
  attachTransport(transport: ExternalTransport): void {
    this.transport = transport;
    console.log("[distributed-event-bridge] External transport attached.");
  }

  /** Initialize the bridge — wire bus events to router + optional transport. */
  init(): void {
    distributedEventRouter.init();

    bus.on("agent.event" as any, async (event: Record<string, unknown>) => {
      if (!this.transport) {
        this.metrics.localOnly++;
        return;
      }

      try {
        const payload = JSON.stringify(event);
        await this.transport.publish("nura-x:distributed:events", payload);
        this.metrics.forwarded++;
      } catch (err) {
        this.metrics.failed++;
        console.error("[distributed-event-bridge] Transport publish failed:", err);
        // Graceful degradation — local delivery already happened via bus
      }
    });

    console.log("[distributed-event-bridge] Initialized — local delivery active.");
  }

  /** Receive an event from the external transport and re-emit locally. */
  async ingest(rawPayload: string): Promise<void> {
    try {
      const event = JSON.parse(rawPayload) as Record<string, unknown>;
      bus.emit("agent.event" as any, event);
    } catch (err) {
      console.error("[distributed-event-bridge] Ingest parse error:", err);
    }
  }

  stats() {
    return { ...this.metrics, hasTransport: this.transport !== null };
  }
}

export const distributedEventBridge = new DistributedEventBridge();
