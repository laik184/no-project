/**
 * server/console/persistence/redis/redis-runtime-cache.ts
 *
 * Redis-backed runtime state cache for distributed deployments.
 * Stub implementation — activate when Redis is provisioned via infrastructure.
 */

import type { RuntimeState } from '../../../shared/console/types.ts';

export const redisRuntimeCache = {
  /** Cache the current runtime state for a project. */
  async set(_projectId: number, _state: RuntimeState): Promise<void> {
    // TODO: await redis.set(`console:runtime:${_projectId}`, _state, { EX: 3600 });
  },

  /** Retrieve a cached runtime state. */
  async get(_projectId: number): Promise<RuntimeState | null> {
    // TODO: return redis.get(`console:runtime:${_projectId}`) as RuntimeState | null;
    return null;
  },

  /** Remove the cached state for a project. */
  async del(_projectId: number): Promise<void> {
    // TODO: await redis.del(`console:runtime:${_projectId}`);
  },
};
