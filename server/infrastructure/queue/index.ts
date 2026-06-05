/**
 * server/infrastructure/queue/index.ts
 *
 * Job queue singleton (BullMQ-backed when Redis is available).
 * Stub implementation — activates when REDIS_URL is set.
 * All queue producers/consumers import from infrastructure/index.ts.
 */

export interface QueueJob {
  id:      string;
  name:    string;
  data:    Record<string, unknown>;
  addedAt: number;
}

export interface IQueue {
  add(jobName: string, data: Record<string, unknown>): Promise<QueueJob>;
  size(): Promise<number>;
  clear(): Promise<void>;
  isReady: boolean;
}

/** No-op queue used when Redis is not configured. */
class NullQueue implements IQueue {
  readonly isReady = false;

  async add(jobName: string, data: Record<string, unknown>): Promise<QueueJob> {
    console.warn(`[queue] NullQueue: job "${jobName}" dropped (no Redis)`);
    return {
      id:      crypto.randomUUID(),
      name:    jobName,
      data,
      addedAt: Date.now(),
    };
  }

  async size(): Promise<number> { return 0; }
  async clear(): Promise<void> {}
}

function createQueue(): IQueue {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('[queue] REDIS_URL not set — using null queue (jobs will be dropped)');
    return new NullQueue();
  }
  // TODO: return new BullMQ Queue('nura-x', { connection: { url } }) when Redis is live
  console.log('[queue] REDIS_URL detected — activate BullMQ for full queue support');
  return new NullQueue();
}

export const queue: IQueue = createQueue();
