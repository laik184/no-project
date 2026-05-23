/**
 * Responsibility: Top-level distributed event bus — publishes events via Redis pub/sub
 *                 with in-process fallback, manages replay buffer, and routes deliveries.
 * Dependencies: redis-pubsub, subscription-manager, event-replay, event-telemetry
 * Failure: publish degrades to in-process delivery if Redis unavailable.
 * Telemetry: delegates all events to event-bus-telemetry.
 */

import { redisPubSub }                   from "./redis-pubsub.ts";
import { distributedSubscriptionManager } from "./subscription-manager.ts";
import { eventReplay }                   from "./event-replay.ts";
import { eventBusTelemetry }             from "./event-telemetry.ts";
import { isRedisAvailable }              from "../redis/index.ts";
import { v4 as uuidv4 }                 from "uuid";
import type { DistributedEvent, SubscriptionOptions } from "./types/index.ts";

class DistributedEventBus {
  private started = false;

  async start(): Promise<void> {
    if (this.started) return;
    await redisPubSub.start();
    this.started = true;
    console.log("[distributed-event-bus] Started — backend:", isRedisAvailable() ? "Redis" : "in-process");
  }

  async publish(
    channel:   string,
    eventType: string,
    runId:     string,
    projectId: number,
    payload:   unknown,
    opts:      { correlationId?: string; replayable?: boolean } = {},
  ): Promise<void> {
    const event: DistributedEvent = {
      id:            uuidv4(),
      channel,
      eventType,
      runId,
      projectId,
      payload,
      correlationId: opts.correlationId,
      ts:            Date.now(),
      replayable:    opts.replayable ?? true,
    };

    eventReplay.record(event);
    eventBusTelemetry.onPublished(event.id, channel, runId);

    // Publish to Redis — crosses process boundaries
    const publishedToRedis = await redisPubSub.publish(channel, event);

    // Always deliver locally (covers same-process subscribers)
    const delivered = distributedSubscriptionManager.deliverLocal(event);
    if (!publishedToRedis && delivered > 0) {
      eventBusTelemetry.onDelivered(event.id, channel, delivered);
    } else if (!publishedToRedis && delivered === 0) {
      eventBusTelemetry.onDropped(event.id, channel, "no-subscribers");
    }
  }

  async subscribe(opts: SubscriptionOptions): Promise<string> {
    return distributedSubscriptionManager.subscribe(opts);
  }

  async unsubscribe(subId: string): Promise<void> {
    return distributedSubscriptionManager.unsubscribe(subId);
  }

  replay(subId: string, sinceTs: number): void {
    distributedSubscriptionManager.replay(subId, sinceTs);
  }

  stats() {
    return {
      started:       this.started,
      backend:       isRedisAvailable() ? "redis" : "in-process",
      subscriptions: distributedSubscriptionManager.activeCount(),
      replayBuffer:  eventReplay.size(),
      metrics:       eventBusTelemetry.snapshot(),
    };
  }

  async stop(): Promise<void> {
    await redisPubSub.stop();
    eventReplay.clear();
    this.started = false;
  }
}

export const distributedEventBus = new DistributedEventBus();
