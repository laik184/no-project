/**
 * server/console/persistence/redis/redis-log-cache.ts
 *
 * Redis-backed log cache for high-throughput tailing.
 * Stub implementation — activate when Redis is provisioned via infrastructure.
 */

export const redisLogCache = {
  /** Push a raw log line to the project's Redis list. */
  async push(_projectId: number, _line: string): Promise<void> {
    // TODO: await redis.lPush(`console:logs:${_projectId}`, _line);
  },

  /** Fetch the N most recent cached log lines. */
  async tail(_projectId: number, _limit: number): Promise<string[]> {
    // TODO: return redis.lRange(`console:logs:${_projectId}`, 0, _limit - 1);
    return [];
  },

  /** Evict all cached lines for a project. */
  async evict(_projectId: number): Promise<void> {
    // TODO: await redis.del(`console:logs:${_projectId}`);
  },
};
