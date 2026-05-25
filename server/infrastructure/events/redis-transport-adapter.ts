/**
 * Responsibility: Adapts the distributed-layer RedisPubSub to the ExternalTransport
 *                 interface expected by DistributedEventBridge.
 *                 This is the bridge between the infrastructure event layer
 *                 and the Redis pub/sub transport layer.
 * Dependencies: distributed/events/redis-pubsub, distributed-event-bridge
 * Failure: publish failures propagate to the bridge which logs + falls back to local.
 * Telemetry: none — pure adapter; callers track telemetry.
 */

import { redisPubSub }      from "../../distributed/events/redis-pubsub.ts";
import type { ExternalTransport } from "./distributed-event-bridge.ts";
import type { DistributedEvent }  from "../../distributed/events/types/index.ts";

// ── Adapter ───────────────────────────────────────────────────────────────────

class RedisPubSubTransportAdapter implements ExternalTransport {
  /**
   * Publish a serialized event payload to a Redis channel.
   * Deserializes the payload back to DistributedEvent for the RedisPubSub API.
   */
  async publish(channel: string, payload: string): Promise<void> {
    let event: DistributedEvent;
    try {
      event = JSON.parse(payload) as DistributedEvent;
    } catch (err) {
      throw new Error(`[redis-transport-adapter] Malformed publish payload: ${(err as Error).message}`);
    }
    const ok = await redisPubSub.publish(channel, event);
    if (!ok) {
      throw new Error(`[redis-transport-adapter] RedisPubSub.publish returned false for channel="${channel}"`);
    }
  }

  /**
   * Subscribe to a Redis channel and invoke `handler` with the raw JSON payload.
   * Wraps the DistributedEvent object back into a JSON string for the bridge.
   */
  async subscribe(channel: string, handler: (msg: string) => void): Promise<void> {
    await redisPubSub.subscribe(channel, (event: DistributedEvent) => {
      try {
        handler(JSON.stringify(event));
      } catch (err) {
        console.error(
          `[redis-transport-adapter] Handler error for channel="${channel}":`,
          (err as Error).message,
        );
      }
    });
  }
}

export const redisPubSubTransportAdapter = new RedisPubSubTransportAdapter();
