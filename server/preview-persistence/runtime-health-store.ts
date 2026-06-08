/**
 * runtime-health-store.ts — In-memory store for RuntimeHealth snapshots.
 * One snapshot per project (latest wins).
 * Imports ONLY from infrastructure/index.ts (none needed — pure in-memory).
 */

import type { RuntimeHealth } from "../preview/domain/entities/runtime-health.ts";

const healthMap = new Map<number, RuntimeHealth>();

export const runtimeHealthStore = {
  save(health: RuntimeHealth): void {
    healthMap.set(health.projectId, health);
  },

  findByProjectId(projectId: number): RuntimeHealth | null {
    return healthMap.get(projectId) ?? null;
  },

  findAll(): RuntimeHealth[] {
    return Array.from(healthMap.values());
  },

  delete(projectId: number): void {
    healthMap.delete(projectId);
  },
};
