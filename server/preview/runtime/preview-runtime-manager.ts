/**
 * preview-runtime-manager.ts — Orchestrates start/stop/restart for preview processes.
 * Bridges infrastructure runtimeManager with preview lifecycle.
 */

import { runtimeManager }   from "../../infrastructure/index.ts";
import { lifecycleManager } from "../lifecycle/preview-lifecycle-manager.ts";
import { healthMonitor }    from "./preview-health-monitor.ts";
import { previewReloader }  from "./preview-reloader.ts";

export interface PreviewStartOptions {
  command: string;
  port?:   number;
  env?:    Record<string, string>;
}

class PreviewRuntimeManager {
  async start(projectId: number, opts: PreviewStartOptions): Promise<{ ok: boolean; error?: string }> {
    await lifecycleManager.markStarting(projectId);

    const result = await runtimeManager.start(projectId, {
      command: opts.command,
      port:    opts.port,
      env:     opts.env,
    });

    if (!result.ok) {
      await lifecycleManager.markCrashed(projectId, null);
      return { ok: false, error: result.error };
    }

    await lifecycleManager.markVerifying(projectId);
    healthMonitor.start(projectId);

    // Give the process a moment to bind its port, then mark ready
    setTimeout(async () => {
      const entry = runtimeManager.get(projectId);
      if (entry?.status === "running") {
        await lifecycleManager.markReady(projectId, result.port ?? null);
      } else {
        await lifecycleManager.markCrashed(projectId, null);
      }
    }, 2_000);

    return { ok: true };
  }

  async stop(projectId: number): Promise<void> {
    healthMonitor.stop(projectId);
    runtimeManager.stop(projectId);
    await lifecycleManager.reset(projectId);
  }

  async restart(projectId: number, opts: PreviewStartOptions): Promise<{ ok: boolean; error?: string }> {
    await lifecycleManager.markRestarting(projectId);
    healthMonitor.stop(projectId);
    runtimeManager.stop(projectId);

    // Short pause to allow port release
    await new Promise(r => setTimeout(r, 500));

    previewReloader.triggerServerRestart(projectId);
    return this.start(projectId, opts);
  }

  isRunning(projectId: number): boolean {
    const entry = runtimeManager.get(projectId);
    return entry?.status === "running";
  }

  getPort(projectId: number): number | null {
    return runtimeManager.get(projectId)?.port ?? null;
  }
}

export const previewRuntimeManager = new PreviewRuntimeManager();
