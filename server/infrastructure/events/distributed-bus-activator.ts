/**
 * server/infrastructure/events/distributed-bus-activator.ts  — P5
 *
 * Activates the DistributedEventBus when Redis is available.
 * Falls back gracefully to the in-process bus when Redis is not configured.
 *
 * Call activateDistributedBus() once at startup — after it resolves, all
 * bus.emit() calls are forwarded to Redis pub/sub so multiple server
 * instances share the same event stream.
 *
 * Single responsibility: bus activation + Redis connectivity only.
 */

import { bus }    from "./bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActivationResult =
  | { mode: "distributed"; channel: string }
  | { mode: "local";       reason: string  };

// ── Telemetry ─────────────────────────────────────────────────────────────────

function log(msg: string): void { console.log(`[distributed-bus] ${msg}`); }
function warn(msg: string): void { console.warn(`[distributed-bus] ${msg}`); }

// ── Redis probe ───────────────────────────────────────────────────────────────

async function probeRedis(url: string): Promise<boolean> {
  try {
    const { createClient } = await import("redis").catch(() => null) as any;
    if (!createClient) return false;
    const client = createClient({ url });
    await Promise.race([
      client.connect(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3_000)),
    ]);
    await client.ping();
    await client.quit();
    return true;
  } catch { return false; }
}

// ── DistributedEventBus stub ─────────────────────────────────────────────────

class DistributedBusAdapter {
  private publisher:  unknown;
  private subscriber: unknown;
  readonly channel:   string;

  constructor(redisUrl: string, channel: string) {
    this.channel = channel;
    this._init(redisUrl).catch(e => warn(`init error: ${e.message}`));
  }

  private async _init(redisUrl: string): Promise<void> {
    const { createClient } = await import("redis") as any;
    this.publisher  = createClient({ url: redisUrl });
    this.subscriber = createClient({ url: redisUrl });
    await (this.publisher  as any).connect();
    await (this.subscriber as any).connect();

    // Forward all local bus events → Redis channel
    const pub = this.publisher as any;
    const ch  = this.channel;
    bus.onAny((event: string, data: unknown) => {
      pub.publish(ch, JSON.stringify({ event, data, ts: Date.now() })).catch(() => {});
    });

    // Forward incoming Redis channel messages → local bus
    await (this.subscriber as any).subscribe(ch, (msg: string) => {
      try {
        const { event, data } = JSON.parse(msg);
        bus.emitLocal?.(event, data);
      } catch {}
    });

    log(`DistributedBus active on channel "${ch}"`);
  }

  async shutdown(): Promise<void> {
    try { await (this.publisher  as any)?.quit(); } catch {}
    try { await (this.subscriber as any)?.quit(); } catch {}
  }
}

let _adapter: DistributedBusAdapter | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Activate distributed bus if REDIS_URL is configured and Redis is reachable.
 * Always resolves — never throws.
 */
export async function activateDistributedBus(opts: {
  redisUrl?: string;
  channel?:  string;
} = {}): Promise<ActivationResult> {
  const redisUrl = opts.redisUrl ?? process.env.REDIS_URL;
  const channel  = opts.channel  ?? process.env.BUS_CHANNEL ?? "nura-x:events";

  if (!redisUrl) {
    warn("REDIS_URL not configured — running in local-bus mode");
    return { mode: "local", reason: "REDIS_URL not set" };
  }

  const reachable = await probeRedis(redisUrl);
  if (!reachable) {
    warn("Redis not reachable — falling back to local-bus mode");
    return { mode: "local", reason: "Redis unreachable" };
  }

  _adapter = new DistributedBusAdapter(redisUrl, channel);
  log(`Activating distributed bus on "${channel}"`);
  return { mode: "distributed", channel };
}

/** Shut down the distributed bus adapter cleanly. */
export async function shutdownDistributedBus(): Promise<void> {
  if (_adapter) { await _adapter.shutdown(); _adapter = null; }
}

/** True if the distributed bus is active. */
export function isDistributedBusActive(): boolean { return _adapter !== null; }
