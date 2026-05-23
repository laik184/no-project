/**
 * Responsibility: Redis Pub/Sub bridge — publishes events to Redis channels
 *                 and subscribes to receive cross-process events.
 * Dependencies: redis-client (dedicated connections for pub/sub)
 * Failure: publish returns false on error; subscribe errors are logged.
 * Telemetry: none — pure transport; callers emit telemetry.
 */

import Redis from "ioredis";
import { createDedicatedClient, isRedisAvailable } from "../redis/redis-client.ts";
import type { DistributedEvent } from "./types/index.ts";

type MessageHandler = (event: DistributedEvent) => void;

class RedisPubSub {
  private publisher:  Redis | null = null;
  private subscriber: Redis | null = null;
  private readonly handlers = new Map<string, Set<MessageHandler>>();
  private started = false;

  async start(): Promise<boolean> {
    if (!isRedisAvailable() || this.started) return false;
    try {
      this.publisher  = createDedicatedClient();
      this.subscriber = createDedicatedClient();

      this.subscriber.on("message", (channel, message) => this.onMessage(channel, message));
      this.subscriber.on("error",   (err) => console.error("[redis-pubsub] Subscriber error:", err.message));
      this.publisher.on("error",    (err) => console.error("[redis-pubsub] Publisher error:", err.message));

      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      this.started = true;
      console.log("[redis-pubsub] Started — pub/sub bridge active.");
      return true;
    } catch (err) {
      console.warn("[redis-pubsub] Failed to start:", (err as Error).message);
      return false;
    }
  }

  async publish(channel: string, event: DistributedEvent): Promise<boolean> {
    if (!this.publisher || !this.started) return false;
    try {
      await this.publisher.publish(`nura:events:${channel}`, JSON.stringify(event));
      return true;
    } catch { return false; }
  }

  async subscribe(channel: string, handler: MessageHandler): Promise<void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      if (this.subscriber && this.started) {
        await this.subscriber.subscribe(`nura:events:${channel}`).catch(console.error);
      }
    }
    this.handlers.get(channel)!.add(handler);
  }

  async unsubscribe(channel: string, handler: MessageHandler): Promise<void> {
    this.handlers.get(channel)?.delete(handler);
    if (this.handlers.get(channel)?.size === 0) {
      this.handlers.delete(channel);
      await this.subscriber?.unsubscribe(`nura:events:${channel}`).catch(() => {});
    }
  }

  async stop(): Promise<void> {
    this.started = false;
    await this.subscriber?.quit().catch(() => {});
    await this.publisher?.quit().catch(() => {});
    this.subscriber = this.publisher = null;
    this.handlers.clear();
  }

  private onMessage(redisChannel: string, raw: string): void {
    const channel  = redisChannel.replace("nura:events:", "");
    const handlers = this.handlers.get(channel);
    if (!handlers?.size) return;
    try {
      const event = JSON.parse(raw) as DistributedEvent;
      for (const h of handlers) h(event);
    } catch (err) {
      console.error("[redis-pubsub] Parse error:", (err as Error).message);
    }
  }
}

export const redisPubSub = new RedisPubSub();
