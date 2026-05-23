/**
 * Responsibility: Manages distributed event subscriptions — registers handlers,
 *                 routes events to subscribers, enforces per-subscription filters.
 * Dependencies: redis-pubsub, event-replay, event-telemetry
 * Failure: handler errors are caught and logged; other subscribers still fire.
 * Telemetry: delegates subscribe/unsubscribe events to event-bus-telemetry.
 */

import { redisPubSub }       from "./redis-pubsub.ts";
import { eventReplay }       from "./event-replay.ts";
import { eventBusTelemetry } from "./event-telemetry.ts";
import type { DistributedEvent, SubscriptionOptions } from "./types/index.ts";

interface Subscription {
  id:      string;
  channel: string;
  handler: (event: DistributedEvent) => void | Promise<void>;
  filter?: (event: DistributedEvent) => boolean;
}

class DistributedSubscriptionManager {
  private readonly subs = new Map<string, Subscription>();
  private seq = 0;

  async subscribe(opts: SubscriptionOptions): Promise<string> {
    const id  = `sub-${++this.seq}-${Date.now()}`;
    const sub: Subscription = { id, channel: opts.channel, handler: opts.handler, filter: opts.filter };
    this.subs.set(id, sub);

    // Wire Redis pub/sub delivery → local handler
    await redisPubSub.subscribe(opts.channel, (event) => this.dispatch(id, event));
    eventBusTelemetry.onSubscribed(opts.channel);
    return id;
  }

  async unsubscribe(subId: string): Promise<void> {
    const sub = this.subs.get(subId);
    if (!sub) return;
    this.subs.delete(subId);
    eventBusTelemetry.onUnsubscribed(sub.channel);
  }

  /** Deliver an event directly to all matching local subscribers (in-process path). */
  deliverLocal(event: DistributedEvent): number {
    let count = 0;
    for (const sub of this.subs.values()) {
      if (sub.channel !== event.channel) continue;
      if (sub.filter && !sub.filter(event)) continue;
      this.invoke(sub, event);
      count++;
    }
    return count;
  }

  /** Replay buffered events to a new subscriber. */
  replay(subId: string, sinceTs: number): void {
    const sub = this.subs.get(subId);
    if (!sub) return;
    const events = eventReplay.since(sub.channel, sinceTs);
    for (const e of events) this.invoke(sub, e);
    if (events.length > 0) eventBusTelemetry.onReplayed(sub.channel, events.length, "system");
  }

  activeCount(): number { return this.subs.size; }

  private dispatch(subId: string, event: DistributedEvent): void {
    const sub = this.subs.get(subId);
    if (!sub) return;
    if (sub.filter && !sub.filter(event)) return;
    this.invoke(sub, event);
  }

  private invoke(sub: Subscription, event: DistributedEvent): void {
    try {
      const result = sub.handler(event);
      if (result instanceof Promise) result.catch(err => console.error(`[subscription-manager] Handler error (${sub.id}):`, err));
    } catch (err) {
      console.error(`[subscription-manager] Sync handler error (${sub.id}):`, err);
    }
  }
}

export const distributedSubscriptionManager = new DistributedSubscriptionManager();
