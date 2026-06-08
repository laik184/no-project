/**
 * runtime-health-service.ts — Runtime health polling and snapshot service.
 * Imports ONLY from repositories/preview/index.ts.
 */

import { runtimeHealthRepository } from "../../repositories/preview/index.ts";
import {
  createRuntimeHealth,
  formatUptime,
} from "../../preview/domain/entities/runtime-health.ts";
import type { RuntimeHealth, RuntimeStatus } from "../../preview/domain/entities/runtime-health.ts";

// ── Infrastructure primitives (allowed cross-layer for process data) ──────────
import { runtimeManager } from "../../infrastructure/index.ts";

export class RuntimeHealthService {
  async snapshot(projectId: number): Promise<RuntimeHealth> {
    const entry = runtimeManager.get(projectId);

    if (!entry || (entry.status !== "running" && entry.status !== "starting")) {
      const h = createRuntimeHealth(projectId);
      await runtimeHealthRepository.save(h);
      return h;
    }

    const uptime = entry.startedAt ? Date.now() - entry.startedAt : 0;

    const health: RuntimeHealth = Object.freeze({
      projectId,
      healthy:      entry.status === "running",
      status:       entry.status as RuntimeStatus,
      port:         entry.port ?? null,
      pid:          entry.pid ?? null,
      uptime,
      uptimeFmt:    formatUptime(uptime),
      restartCount: entry.restartCount ?? 0,
      memoryBytes:  null,   // future: poll /proc/<pid>/status
      cpuPercent:   null,
      lastRestart:  entry.startedAt ?? null,
      checkedAt:    Date.now(),
    });

    await runtimeHealthRepository.save(health);
    return health;
  }

  async getCached(projectId: number): Promise<RuntimeHealth | null> {
    return runtimeHealthRepository.findByProjectId(projectId);
  }

  async getAll(): Promise<RuntimeHealth[]> {
    return runtimeHealthRepository.findAll();
  }

  async invalidate(projectId: number): Promise<void> {
    await runtimeHealthRepository.delete(projectId);
  }
}

export const runtimeHealthService = new RuntimeHealthService();
