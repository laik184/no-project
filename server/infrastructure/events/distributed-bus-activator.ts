/**
 * server/infrastructure/events/distributed-bus-activator.ts
 *
 * Activates the distributed event bus when Redis is available.
 * Delegates entirely to the canonical DistributedEventBus (ioredis + BullMQ layer).
 * Falls back gracefully to the in-process bus when Redis is not configured.
 *
 * Call activateDistributedBus() once at startup — after it resolves, all
 * bus.emit() calls are forwarded to Redis pub/sub so multiple server
 * instances share the same event stream.
 *
 * Single responsibility: bus activation + Redis availability check only.
 * NOTE: Previous implementation used the `redis` npm package with bus.emitLocal?.()
 *       (which does not exist). This version delegates to the ioredis-backed
 *       distributedEventBus which is the production-correct implementation.
 */

import { distributedEventBus } from "../../distributed/events/distributed-event-bus.ts";
import { isRedisAvailable }    from "../../distributed/redis/index.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivationResult =
  | { mode: "distributed"; channel: string }
  | { mode: "local";       reason: string  };

// ── Telemetry ─────────────────────────────────────────────────────────────────

function log(msg: string):  void { console.log(`[distributed-bus] ${msg}`); }
function warn(msg: string): void { console.warn(`[distributed-bus] ${msg}`); }

// ── Activation state ──────────────────────────────────────────────────────────

let _active = false;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Activate the distributed bus if Redis is reachable.
 * Always resolves — never throws.
 */
export async function activateDistributedBus(opts: {
  channel?: string;
} = {}): Promise<ActivationResult> {
  const channel = opts.channel ?? process.env.BUS_CHANNEL ?? "nura-x:events";

  if (!isRedisAvailable()) {
    warn("Redis not available — running in local-bus mode");
    return { mode: "local", reason: "Redis not available" };
  }

  if (_active) {
    return { mode: "distributed", channel };
  }

  try {
    await distributedEventBus.start();
    _active = true;
    log(`Distributed bus activated — channel="${channel}"`);
    return { mode: "distributed", channel };
  } catch (err) {
    warn(`Failed to activate distributed bus: ${(err as Error).message} — falling back to local`);
    return { mode: "local", reason: (err as Error).message };
  }
}

/** Shut down the distributed bus cleanly. */
export async function shutdownDistributedBus(): Promise<void> {
  if (!_active) return;
  await distributedEventBus.stop();
  _active = false;
}

/** True if the distributed bus is active. */
export function isDistributedBusActive(): boolean { return _active; }
