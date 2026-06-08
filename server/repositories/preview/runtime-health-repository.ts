/**
 * runtime-health-repository.ts — RuntimeHealth repository.
 * Imports ONLY from preview-persistence/index.ts.
 */

import { runtimeHealthStore, previewCache, CacheKey, TTL } from "../../preview-persistence/index.ts";
import type { IRuntimeHealthRepository } from "../../preview/domain/interfaces/runtime-health-repository.ts";
import type { RuntimeHealth }            from "../../preview/domain/entities/runtime-health.ts";

class RuntimeHealthRepository implements IRuntimeHealthRepository {
  async save(health: RuntimeHealth): Promise<void> {
    runtimeHealthStore.save(health);
    previewCache.set(CacheKey.health(health.projectId), health, TTL.HEALTH);
  }

  async findByProjectId(projectId: number): Promise<RuntimeHealth | null> {
    const cached = previewCache.get<RuntimeHealth>(CacheKey.health(projectId));
    if (cached) return cached;

    const health = runtimeHealthStore.findByProjectId(projectId);
    if (health) {
      previewCache.set(CacheKey.health(projectId), health, TTL.HEALTH);
    }
    return health;
  }

  async findAll(): Promise<RuntimeHealth[]> {
    return runtimeHealthStore.findAll();
  }

  async delete(projectId: number): Promise<void> {
    runtimeHealthStore.delete(projectId);
    previewCache.delete(CacheKey.health(projectId));
  }
}

export const runtimeHealthRepository = new RuntimeHealthRepository();
