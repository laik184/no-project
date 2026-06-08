/**
 * preview-reloader.ts — Handles reload dispatch to connected SSE clients.
 * Emits reload events. Debounce is handled by reloadService.
 */

import { reloadService }          from "../../services/preview/index.ts";
import { previewSseManager }      from "../streaming/preview-sse-manager.ts";
import { PREVIEW_TOPIC }          from "../streaming/preview-topic-registry.ts";
import { lifecycleManager }       from "../lifecycle/preview-lifecycle-manager.ts";
import type { ReloadType }        from "../../services/preview/index.ts";

class PreviewReloader {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    console.log("[preview-reloader] Initialized.");
  }

  requestReload(
    projectId:  number,
    reloadType: ReloadType,
    reason:     string,
  ): void {
    reloadService.request(projectId, reloadType, reason);
    reloadService.onReload(projectId, (type, r) => {
      this.executeReload(projectId, type, r);
    });
  }

  private executeReload(
    projectId:  number,
    reloadType: ReloadType,
    reason:     string,
  ): void {
    const payload = {
      projectId,
      reloadType,
      reason,
      ts: Date.now(),
    };

    previewSseManager.broadcast(PREVIEW_TOPIC.RELOAD, payload, projectId);

    if (reloadType === "hot") {
      lifecycleManager.markHotReload(projectId).catch(console.error);
    } else if (reloadType === "server-restart") {
      lifecycleManager.markRestarting(projectId).catch(console.error);
    }
  }

  triggerHotReload(projectId: number, changedFiles: string[] = []): void {
    this.requestReload(projectId, "hot", `Hot reload: ${changedFiles.join(", ")}`);
  }

  triggerHardReload(projectId: number): void {
    this.requestReload(projectId, "hard", "Hard reload requested.");
  }

  triggerSoftReload(projectId: number): void {
    this.requestReload(projectId, "soft", "Soft reload requested.");
  }

  triggerServerRestart(projectId: number): void {
    this.requestReload(projectId, "server-restart", "Server restart.");
  }
}

export const previewReloader = new PreviewReloader();
