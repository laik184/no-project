/**
 * Responsibility: Bridges the in-process event bus to the Redis pub/sub transport.
 *                 Wires RedisPubSub as the external transport automatically when
 *                 Redis is available. Falls back to local-only delivery gracefully.
 * Dependencies: bus, distributed-event-router, redis-transport-adapter, redis/index
 * Failure: transport errors are logged; bridge degrades to local-only delivery.
 * Telemetry: all forwarded events counted; transport errors tracked separately.
 */

import { bus }                          from "./bus.ts";
import { distributedEventRouter }       from "./distributed-event-router.ts";
import { isRedisAvailable }             from "../../distributed/redis/index.ts";
import { redisOnConnectHooks }          from "../../distributed/redis/redis-on-connect-hooks.ts";

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

  /**
   * Initialize the bridge.
   * - Wires bus events to the distributed event router.
   * - Attaches the Redis pub/sub transport immediately when Redis is available.
   * - Registers a hook so the transport is attached automatically on Redis reconnect.
   */
  init(): void {
    distributedEventRouter.init();

    // Try to attach Redis transport now; also register a hook for deferred connect.
    this.tryAttachRedisTransport();
    redisOnConnectHooks.register("event-bridge-redis-transport", () => this.tryAttachRedisTransport());

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
        console.error("[distributed-event-bridge] Transport publish failed:", (err as Error).message);
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
      console.error("[distributed-event-bridge] Ingest parse error:", (err as Error).message);
    }
  }

  stats() {
    return { ...this.metrics, hasTransport: this.transport !== null };
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private tryAttachRedisTransport(): void {
    if (this.transport) return; // already attached
    if (!isRedisAvailable()) return;

    // Lazy import to avoid circular-dependency at module load time.
    import("./redis-transport-adapter.ts")
      .then(({ redisPubSubTransportAdapter }) => {
        this.attachTransport(redisPubSubTransportAdapter);
        console.log("[distributed-event-bridge] Redis pub/sub transport wired ✓");
      })
      .catch(err => {
        console.error("[distributed-event-bridge] Failed to attach Redis transport:", (err as Error).message);
      });
  }
}

export const distributedEventBridge = new DistributedEventBridge();
