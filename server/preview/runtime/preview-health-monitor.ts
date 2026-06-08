/**
 * preview-health-monitor.ts — Periodic runtime health polling.
 * Polls runtimeHealthService and broadcasts health events via previewSseManager.
 */

import { runtimeHealthService }   from "../../services/preview/index.ts";
import { previewSseManager }      from "../streaming/preview-sse-manager.ts";
import { PREVIEW_TOPIC }          from "../streaming/preview-topic-registry.ts";

const DEFAULT_INTERVAL_MS = 5_000;

class PreviewHealthMonitor {
  private readonly timers = new Map<number, ReturnType<typeof setInterval>>();

  start(projectId: number, intervalMs = DEFAULT_INTERVAL_MS): void {
    if (this.timers.has(projectId)) return;

    const timer = setInterval(async () => {
      try {
        const health = await runtimeHealthService.snapshot(projectId);

        previewSseManager.broadcast(
          PREVIEW_TOPIC.HEALTH,
          {
            projectId,
            healthy:      health.healthy,
            status:       health.status,
            port:         health.port,
            pid:          health.pid,
            uptime:       health.uptime,
            uptimeFmt:    health.uptimeFmt,
            restartCount: health.restartCount,
            checkedAt:    health.checkedAt,
          },
          projectId,
        );
      } catch (err) {
        console.error(`[health-monitor] projectId=${projectId}`, err);
      }
    }, intervalMs);

    this.timers.set(projectId, timer);
    console.log(`[health-monitor] Started for project ${projectId} (${intervalMs}ms).`);
  }

  stop(projectId: number): void {
    const timer = this.timers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(projectId);
      console.log(`[health-monitor] Stopped for project ${projectId}.`);
    }
  }

  stopAll(): void {
    for (const [projectId] of this.timers) this.stop(projectId);
  }

  isRunning(projectId: number): boolean {
    return this.timers.has(projectId);
  }
}

export const healthMonitor = new PreviewHealthMonitor();
