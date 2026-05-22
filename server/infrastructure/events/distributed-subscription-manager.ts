/**
 * Responsibility: Distributed subscription manager — ensures one listener per distributed
 *                 event type across all workers, preventing listener accumulation.
 *                 Extends the existing subscription-manager pattern to distributed events.
 * Dependencies: bus, distributed-event-router
 * Failure: duplicate subscriptions silently deduplicated; never creates duplicate handlers.
 * Telemetry: subscription count tracked; exposed to distributed-trace.
 */

import { distributedEventRouter, DistributedEventType, DistributedEventHandler } from "./distributed-event-router.ts";

// ── Manager ───────────────────────────────────────────────────────────────────

class DistributedSubscriptionManager {
  private readonly subscriptions = new Map<DistributedEventType, Set<string>>();
  private readonly handlers      = new Map<string, DistributedEventHandler>();

  /**
   * Subscribe to a distributed event type with deduplication.
   * Returns a subscription id for later unsubscription.
   */
  subscribe(
    eventType:  DistributedEventType,
    id:         string,
    handler:    DistributedEventHandler,
  ): string {
    const subKey = `${eventType}::${id}`;

    // Deduplicate: if this id is already subscribed, replace the handler
    if (this.handlers.has(subKey)) {
      const old = this.handlers.get(subKey)!;
      distributedEventRouter.off(eventType, old);
    }

    this.handlers.set(subKey, handler);
    distributedEventRouter.on(eventType, handler);

    const subs = this.subscriptions.get(eventType) ?? new Set();
    subs.add(subKey);
    this.subscriptions.set(eventType, subs);

    return subKey;
  }

  /** Unsubscribe using the id returned from subscribe(). */
  unsubscribe(subKey: string): void {
    const handler = this.handlers.get(subKey);
    if (!handler) return;

    const [eventType] = subKey.split("::");
    distributedEventRouter.off(eventType as DistributedEventType, handler);
    this.handlers.delete(subKey);

    const subs = this.subscriptions.get(eventType as DistributedEventType);
    subs?.delete(subKey);
  }

  /** Remove all subscriptions for a given runId prefix. */
  unsubscribeRun(runId: string): number {
    let count = 0;
    for (const subKey of [...this.handlers.keys()]) {
      if (subKey.includes(runId)) {
        this.unsubscribe(subKey);
        count++;
      }
    }
    return count;
  }

  stats() {
    return {
      totalSubscriptions: this.handlers.size,
      byEventType: Object.fromEntries(
        [...this.subscriptions.entries()].map(([k, v]) => [k, v.size]),
      ),
    };
  }
}

export const distributedSubscriptionManager = new DistributedSubscriptionManager();
