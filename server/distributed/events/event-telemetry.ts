/**
 * Responsibility: Telemetry for the distributed event bus — publish, delivery,
 *                 drop, replay, subscribe, and unsubscribe events.
 * Dependencies: bus
 * Failure: all methods non-throwing; errors logged and swallowed.
 * Telemetry: this IS the telemetry module for the distributed event layer.
 */

import { bus }               from "../../infrastructure/events/bus.ts";
import type { DistributedEventType } from "./types/index.ts";

interface EventBusMetrics {
  published:   number;
  delivered:   number;
  dropped:     number;
  replayed:    number;
  subscriptions: number;
}

class EventBusTelemetry {
  private readonly m: EventBusMetrics = {
    published: 0, delivered: 0, dropped: 0, replayed: 0, subscriptions: 0,
  };

  onPublished(eventId: string, channel: string, runId: string): void {
    this.m.published++;
    this.emit("event.published", runId, { eventId, channel });
  }

  onDelivered(eventId: string, channel: string, subscriberCount: number): void {
    this.m.delivered++;
    this.emit("event.delivered", "system", { eventId, channel, subscriberCount });
  }

  onDropped(eventId: string, channel: string, reason: string): void {
    this.m.dropped++;
    this.emit("event.dropped", "system", { eventId, channel, reason });
  }

  onReplayed(channel: string, count: number, runId: string): void {
    this.m.replayed += count;
    this.emit("event.replayed", runId, { channel, count });
  }

  onSubscribed(channel: string): void {
    this.m.subscriptions++;
    this.emit("event.subscribed", "system", { channel });
  }

  onUnsubscribed(channel: string): void {
    this.m.subscriptions = Math.max(0, this.m.subscriptions - 1);
    this.emit("event.unsubscribed", "system", { channel });
  }

  snapshot(): EventBusMetrics { return { ...this.m }; }

  private emit(eventType: DistributedEventType, runId: string, payload: Record<string, unknown>): void {
    try {
      bus.emit("agent.event", {
        runId, projectId: 0,
        phase: "distributed.events",
        agentName: "event-bus-telemetry",
        eventType, payload, ts: Date.now(),
      });
    } catch (err) { console.error("[event-bus-telemetry] Emit error:", err); }
  }
}

export const eventBusTelemetry = new EventBusTelemetry();
