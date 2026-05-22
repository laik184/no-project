/**
 * server/quantum/integration/runtime-bridge.ts
 *
 * Runtime-aware scheduling guard. Checks live runtime health (port reachable,
 * process alive) before allowing pool submissions for preview/validation tasks.
 * Prevents scheduling work against a dead or starting runtime.
 *
 * Non-runtime tasks (e.g. LLM calls, file ops) bypass the runtime check.
 */

import { centralWorkerPool }   from "../scheduler/worker-pool.ts";
import type { PoolTask, PoolResult } from "../scheduler/worker-types.ts";
import { bus }                 from "../../infrastructure/events/bus.ts";

// ── Runtime health cache ──────────────────────────────────────────────────────

interface RuntimeHealth {
  projectId:     number;
  available:     boolean;
  checkedAt:     number;
  ttlMs:         number;
}

const CACHE_TTL_MS   = 5_000;   // re-check every 5 seconds
const RUNTIME_PORT   = 5000;    // default Vite dev port

// ── Runtime bridge ────────────────────────────────────────────────────────────

class RuntimeBridge {
  private readonly _healthCache = new Map<number, RuntimeHealth>();

  /**
   * Submit a task that requires the runtime to be alive (e.g. browser
   * screenshot, preview check). Rejects immediately if runtime is down.
   */
  async submitWithRuntimeCheck<T>(
    task:      PoolTask<T>,
    projectId: number,
  ): Promise<PoolResult<T>> {
    const healthy = await this.isRuntimeAvailable(projectId);

    if (!healthy) {
      bus.emit("agent.event", {
        runId:     task.runId,
        eventType: "runtime.bridge.unavailable" as any,
        phase:     "runtime-bridge",
        ts:        Date.now(),
        payload:   { taskId: task.id, projectId, reason: "Runtime not reachable" },
      });

      return {
        taskId:     task.id,
        runId:      task.runId,
        success:    false,
        error:      `Runtime for project ${projectId} is not available`,
        durationMs: 0,
        retryCount: 0,
        workerId:   "none",
      };
    }

    return centralWorkerPool.submit<T>(task);
  }

  /**
   * Check if the dev runtime for a project is reachable.
   * Results are cached for CACHE_TTL_MS to avoid hammering the probe.
   */
  async isRuntimeAvailable(projectId: number): Promise<boolean> {
    const cached = this._healthCache.get(projectId);
    if (cached && Date.now() - cached.checkedAt < cached.ttlMs) {
      return cached.available;
    }

    const available = await this._probe(projectId);
    this._healthCache.set(projectId, {
      projectId,
      available,
      checkedAt: Date.now(),
      ttlMs:     CACHE_TTL_MS,
    });

    return available;
  }

  /** Invalidate the cached runtime health for a project. */
  invalidate(projectId: number): void {
    this._healthCache.delete(projectId);
  }

  stats() {
    const entries: Record<number, Omit<RuntimeHealth, "projectId">> = {};
    for (const [id, h] of this._healthCache) {
      entries[id] = { available: h.available, checkedAt: h.checkedAt, ttlMs: h.ttlMs };
    }
    return { cachedProjects: entries };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _probe(projectId: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 2_000);
      const url        = `http://localhost:${RUNTIME_PORT}/`;

      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
      return res.ok || res.status < 500;
    } catch {
      return false;
    }
  }
}

export const runtimeBridge = new RuntimeBridge();
