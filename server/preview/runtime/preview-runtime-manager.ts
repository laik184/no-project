/**
 * preview-runtime-manager.ts — Orchestrates start/stop/restart for preview processes.
 * Bridges infrastructure runtimeManager with preview lifecycle.
 */

import { runtimeManager }   from "../../infrastructure/index.ts";
import { lifecycleManager } from "../lifecycle/preview-lifecycle-manager.ts";
import { healthMonitor }    from "./preview-health-monitor.ts";
import { previewReloader }  from "./preview-reloader.ts";
import { bus }              from "../../infrastructure/index.ts";

export interface PreviewStartOptions {
  command: string;
  port?:   number;
  cwd?:    string;
  env?:    Record<string, string>;
}

// How long to wait for port detection before falling back to markReady(null).
const PORT_WAIT_MS     = 10_000;
const PORT_POLL_MS     = 200;

class PreviewRuntimeManager {
  async start(projectId: number, opts: PreviewStartOptions): Promise<{ ok: boolean; error?: string }> {
    await lifecycleManager.markStarting(projectId);

    const result = await runtimeManager.start(projectId, {
      command: opts.command,
      port:    opts.port,
      cwd:     opts.cwd,
      env:     opts.env,
    });

    if (!result.ok) {
      await lifecycleManager.markCrashed(projectId, null);
      return { ok: false, error: result.error };
    }

    await lifecycleManager.markVerifying(projectId);
    healthMonitor.start(projectId);

    // Wait for port detection (up to PORT_WAIT_MS), then mark ready.
    this._waitForPortAndMarkReady(projectId);

    return { ok: true };
  }

  private _waitForPortAndMarkReady(projectId: number): void {
    const deadline = Date.now() + PORT_WAIT_MS;
    let   unsubscribe: (() => void) | null = null;

    const markReady = async (port: number | null) => {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      const entry = runtimeManager.get(projectId);
      if (!entry || entry.status === 'crashed' || entry.status === 'stopped') {
        await lifecycleManager.markCrashed(projectId, null).catch(console.error);
        return;
      }
      await lifecycleManager.markReady(projectId, port).catch(console.error);
    };

    // Subscribe to bus port_detected event.
    const handler = (payload: Record<string, unknown>) => {
      if ((payload.projectId as number) !== projectId) return;
      markReady(payload.port as number);
    };
    bus.on('runtime.port_detected' as never, handler as never);
    unsubscribe = () => bus.off('runtime.port_detected' as never, handler as never);

    // Polling fallback: if port was detected synchronously (fast startup),
    // OR deadline passes without port detection → mark ready with whatever we have.
    const poll = setInterval(async () => {
      const entry = runtimeManager.get(projectId);

      // Process crashed or stopped — the bus.on('process.crashed') handler in
      // lifecycle-events.ts already transitions the state machine to "crashed".
      // Do NOT call markCrashed here: that causes a spurious crashed→crashed
      // transition when the bus handler fires first.
      if (!entry || entry.status === 'crashed' || entry.status === 'stopped') {
        clearInterval(poll);
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        return;
      }

      // Port was detected — mark ready.
      if (entry.port) {
        clearInterval(poll);
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        await markReady(entry.port);
        return;
      }

      // Deadline reached — mark ready without a port (proxy will use default 3000).
      if (Date.now() >= deadline) {
        clearInterval(poll);
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        await markReady(null);
      }
    }, PORT_POLL_MS);
  }

  async stop(projectId: number): Promise<void> {
    healthMonitor.stop(projectId);
    runtimeManager.stop(projectId);
    await lifecycleManager.reset(projectId);
  }

  async restart(projectId: number, opts: PreviewStartOptions): Promise<{ ok: boolean; error?: string }> {
    await lifecycleManager.markRestarting(projectId);
    healthMonitor.stop(projectId);

    // Use runtimeManager.restart — it waits for child exit + frees the port.
    // Pass only non-port options; restart() preserves the existing port.
    await runtimeManager.restart(projectId, {
      command: opts.command,
      cwd:     opts.cwd,
      env:     opts.env,
    });

    previewReloader.triggerServerRestart(projectId);
    await lifecycleManager.markVerifying(projectId);
    healthMonitor.start(projectId);
    this._waitForPortAndMarkReady(projectId);
    return { ok: true };
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
